// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, fireEvent, render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingPerceivedRank, { DATA_TEST_ID } from "./SkillsRankingPerceivedRank";
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

// Mock the slider to a simple input that forwards onChange(event, value)
jest.mock("src/features/skillsRanking/components/skillsRankingSlider/SkillsRankingSlider", () => ({
  __esModule: true,
  default: ({ onChange, ...props }: any) => (
    <input
      type="range"
      data-testid={props["data-testid"]}
      aria-label={props["aria-label"]}
      onChange={(e: any) => onChange(e, Number(e.target.value))}
    />
  ),
}));

jest.mock("src/features/skillsRanking/utils/createMessages", () => ({
  shouldSkipMarketDisclosure: jest.fn(() => true),
}));

describe("SkillsRankingPerceivedRank", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Force online context
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: jest.fn(),
    });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const flush = async () => {
    await act(async () => Promise.resolve());
  };

  const createState = (phase: SkillsRankingPhase, perceived?: number): SkillsRankingState => ({
    session_id: 1,
    experiment_group: SkillsRankingExperimentGroups.GROUP_1,
    phases: [{ name: phase, time: new Date().toISOString() }],
    score: {
      jobs_matching_rank: 0,
      comparison_rank: 0,
      comparison_label: "MIDDLE",
      calculated_at: new Date().toISOString(),
    },
    started_at: new Date().toISOString(),
    perceived_rank_percentile: perceived,
  });

  const setSliderValue = (testId: string, value: number) => {
    const input = screen.getByTestId(testId) as HTMLInputElement;
    fireEvent.change(input, { target: { value: String(value) } });
  };

  test("should submit perceived rank and call service then onFinish (with market disclosure -> next RETYPED_RANK)", async () => {
    // GIVEN disclosure enabled
    const { shouldSkipMarketDisclosure } = jest.requireMock("src/features/skillsRanking/utils/createMessages");
    shouldSkipMarketDisclosure.mockReturnValue(false);

    const givenSessionId = 24680;
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
    const givenState = createState(SkillsRankingPhase.PERCEIVED_RANK)
    const givenUserPerceivedRankValue = 42

    // WHEN rendering, change slider and submit
    render(<SkillsRankingPerceivedRank onFinish={actualOnFinish} skillsRankingState={givenState} />);
    setSliderValue(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SLIDER, givenUserPerceivedRankValue);
    await flush();
    const givenSubmitButton1 = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON);
    expect(givenSubmitButton1).not.toBeDisabled();
    act(() => {
      givenSubmitButton1.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // THEN typing shows (after state set) and service called then finish
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();
    // run typing completion timer
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.RETYPED_RANK, givenUserPerceivedRankValue);
    expect(actualOnFinish).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should submit perceived rank and complete flow when disclosure skipped (next COMPLETED)", async () => {
    // GIVEN disclosure skipped
    const { shouldSkipMarketDisclosure } = jest.requireMock("src/features/skillsRanking/utils/createMessages");
    shouldSkipMarketDisclosure.mockReturnValue(true);
    const givenSessionId = 13579;
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
    const givenState = createState(SkillsRankingPhase.PERCEIVED_RANK);

    render(<SkillsRankingPerceivedRank onFinish={actualOnFinish} skillsRankingState={givenState} />);
    setSliderValue(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SLIDER, 7);
    await flush();
    const givenSubmitButton2 = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON);
    expect(givenSubmitButton2).not.toBeDisabled();
    act(() => {
      givenSubmitButton2.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.COMPLETED, 7);
    // run typing completion timer then expect finish called
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();
    expect(actualOnFinish).toHaveBeenCalled();
  });

  test("should log error and not proceed when no active session id", async () => {
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
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => null } as any);
    const actualOnFinish = jest.fn();
    const givenState = createState(SkillsRankingPhase.PERCEIVED_RANK);

    render(<SkillsRankingPerceivedRank onFinish={actualOnFinish} skillsRankingState={givenState} />);
    setSliderValue(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SLIDER, 10);
    await flush();
    const givenSubmitButton3 = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON);
    expect(givenSubmitButton3).not.toBeDisabled();
    act(() => {
      givenSubmitButton3.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(console.error).toHaveBeenCalled();
    expect(actualOnFinish).not.toHaveBeenCalled();
  });

  test("should show snackbar and allow retry when service fails", async () => {
    const givenSessionId = 1122;
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: jest.fn().mockRejectedValue(new Error("boom")),
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
    const actualOnFinish = jest.fn();
    const givenState = createState(SkillsRankingPhase.PERCEIVED_RANK);

    render(<SkillsRankingPerceivedRank onFinish={actualOnFinish} skillsRankingState={givenState} />);
    setSliderValue(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SLIDER, 10);
    const submit = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON);
    act(() => {
      submit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await flush();
    expect(console.error).toHaveBeenCalled();
    expect(actualOnFinish).not.toHaveBeenCalled();
  });
});
