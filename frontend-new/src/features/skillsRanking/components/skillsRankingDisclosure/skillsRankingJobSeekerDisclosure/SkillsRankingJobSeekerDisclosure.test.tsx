// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingJobSeekerDisclosure, { DATA_TEST_ID } from "./SkillsRankingJobSeekerDisclosure";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { shouldSkipMarketDisclosure } from "src/features/skillsRanking/utils/createMessages";

jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

jest.mock("src/features/skillsRanking/utils/createMessages", () => ({
  shouldSkipMarketDisclosure: jest.fn(() => false),
}));

describe("SkillsRankingJobSeekerDisclosure", () => {
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

  const createState = (phase: SkillsRankingPhase, label: string): SkillsRankingState => ({
    session_id: 1,
    experiment_group: SkillsRankingExperimentGroups.GROUP_3,
    phases: [{ name: phase, time: new Date().toISOString() }],
    score: {
      jobs_matching_rank: 50,
      comparison_rank: 50,
      comparison_label: label,
      calculated_at: new Date().toISOString(),
    },
    started_at: new Date().toISOString(),
  });

  test("should auto-advance after two typing steps and call service with PERCEIVED_RANK (non-replay)", async () => {
    // GIVEN active session and service
    const givenSessionId = 12345;
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

    // WHEN render and run timers for show/hide typing and continue
    render(
      <SkillsRankingJobSeekerDisclosure
        onFinish={actualOnFinish}
        skillsRankingState={createState(SkillsRankingPhase.JOB_SEEKER_DISCLOSURE, "MIDDLE")}
      />
    );
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_JOB_SEEKER_DISCLOSURE_CONTAINER)).toBeInTheDocument();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();

    // THEN service advances to PERCEIVED_RANK and onFinish called
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.PERCEIVED_RANK);
    expect(actualOnFinish).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should render undisclosed message when market disclosure is skipped and still auto-advance", async () => {
    // GIVEN skip
    (shouldSkipMarketDisclosure as jest.Mock).mockReturnValueOnce(true);
    const givenSessionId = 555;
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

    render(
      <SkillsRankingJobSeekerDisclosure
        onFinish={actualOnFinish}
        skillsRankingState={createState(SkillsRankingPhase.JOB_SEEKER_DISCLOSURE, "MIDDLE")}
      />
    );
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();

    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.PERCEIVED_RANK);
    expect(actualOnFinish).toHaveBeenCalled();
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
    const actualOnFinish = jest.fn();

    render(
      <SkillsRankingJobSeekerDisclosure
        onFinish={actualOnFinish}
        skillsRankingState={createState(SkillsRankingPhase.PERCEIVED_RANK, "MIDDLE")}
      />
    );
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(actualOnFinish).not.toHaveBeenCalled();
  });

  test("snapshot: non-replay initial render", () => {
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
      <SkillsRankingJobSeekerDisclosure
        onFinish={jest.fn()}
        skillsRankingState={createState(SkillsRankingPhase.JOB_SEEKER_DISCLOSURE, "MIDDLE")}
      />
    );
    expect(container).toMatchSnapshot();
  });
});
