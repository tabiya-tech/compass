// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingJobMarketDisclosure, { DATA_TEST_ID } from "./SkillsRankingJobMarketDisclosure";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

jest.mock("src/features/skillsRanking/utils/createMessages", () => ({
  shouldSkipMarketDisclosure: jest.fn((group: any) =>
    ["Group 2: High Difference/Smaller", "Group 4: Underconfidence/No"].includes(group)
  ),
}));

describe("SkillsRankingJobMarketDisclosure", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: jest.fn() });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const flush = async () => {
    await act(async () => Promise.resolve());
  };

  const createState = (group: SkillsRankingExperimentGroups, phase: SkillsRankingPhase): SkillsRankingState => ({
    session_id: 1,
    experiment_group: group,
    phases: [{ name: phase, time: new Date().toISOString() }],
    score: {
      jobs_matching_rank: 42,
      comparison_rank: 50,
      comparison_label: "MIDDLE",
      calculated_at: new Date().toISOString(),
    },
    started_at: new Date().toISOString(),
  });

  test("should auto-advance after two long typing steps to JOB_SEEKER_DISCLOSURE when not skipped", async () => {
    // GIVEN active session and service
    const givenSessionId = 321;
    const mockUpdate = jest.fn().mockResolvedValue({} as SkillsRankingState);
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdate,
      getConfig: () => ({
        config: {
          compensationAmount: "$1",
          jobPlatformUrl: "x",
          shortTypingDurationMs: 1,
          defaultTypingDurationMs: 1,
          longTypingDurationMs: 1,
        },
      }),
    } as unknown as SkillsRankingService);
    jest
      .spyOn(UserPreferencesStateService, "getInstance")
      .mockReturnValue({ getActiveSessionId: () => givenSessionId } as any);
    const actualOnFinish = jest.fn().mockResolvedValue(undefined);

    // WHEN render and run timers
    render(
      <SkillsRankingJobMarketDisclosure
        onFinish={actualOnFinish}
        skillsRankingState={createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.MARKET_DISCLOSURE)}
      />
    );
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_JOB_MARKET_DISCLOSURE_CONTAINER)).toBeInTheDocument();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();

    // THEN update to next phase and onFinish called
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.JOB_SEEKER_DISCLOSURE);
    expect(actualOnFinish).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should skip entirely for groups 2 and 4 and still advance", async () => {
    const givenSessionId = 987;
    const mockUpdate = jest.fn().mockResolvedValue({} as SkillsRankingState);
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdate,
      getConfig: () => ({
        config: {
          compensationAmount: "$1",
          jobPlatformUrl: "x",
          shortTypingDurationMs: 1,
          defaultTypingDurationMs: 1,
          longTypingDurationMs: 1,
        },
      }),
    } as unknown as SkillsRankingService);
    jest
      .spyOn(UserPreferencesStateService, "getInstance")
      .mockReturnValue({ getActiveSessionId: () => givenSessionId } as any);
    const actualOnFinish = jest.fn().mockResolvedValue(undefined);

    // WHEN render with group 2 (skip)
    const { rerender } = render(
      <SkillsRankingJobMarketDisclosure
        onFinish={actualOnFinish}
        skillsRankingState={createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.MARKET_DISCLOSURE)}
      />
    );
    // component returns null but should still call update via effect
    await flush();
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.JOB_SEEKER_DISCLOSURE);

    // WHEN render with group 4 (skip)
    rerender(
      <SkillsRankingJobMarketDisclosure
        onFinish={actualOnFinish}
        skillsRankingState={createState(SkillsRankingExperimentGroups.GROUP_4, SkillsRankingPhase.MARKET_DISCLOSURE)}
      />
    );
    await flush();
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.JOB_SEEKER_DISCLOSURE);
  });

  test("should do nothing in replay mode", async () => {
    const mockUpdate = jest.fn();
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdate,
      getConfig: () => ({
        config: {
          compensationAmount: "$1",
          jobPlatformUrl: "x",
          shortTypingDurationMs: 1,
          defaultTypingDurationMs: 1,
          longTypingDurationMs: 1,
        },
      }),
    } as unknown as SkillsRankingService);
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => 1 } as any);

    render(
      <SkillsRankingJobMarketDisclosure
        onFinish={jest.fn()}
        skillsRankingState={createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.PERCEIVED_RANK)}
      />
    );
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("snapshot: non-replay initial render (not skipped)", () => {
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: jest.fn(),
      getConfig: () => ({
        config: {
          compensationAmount: "$1",
          jobPlatformUrl: "x",
          shortTypingDurationMs: 1,
          defaultTypingDurationMs: 1,
          longTypingDurationMs: 1,
        },
      }),
    } as unknown as SkillsRankingService);
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => 1 } as any);
    const { container } = render(
      <SkillsRankingJobMarketDisclosure
        onFinish={jest.fn()}
        skillsRankingState={createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.MARKET_DISCLOSURE)}
      />
    );
    expect(container).toMatchSnapshot();
  });
});
