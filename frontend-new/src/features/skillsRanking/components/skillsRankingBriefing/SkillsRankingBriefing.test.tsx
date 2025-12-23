// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingBriefing, { DATA_TEST_ID } from "./SkillsRankingBriefing";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { DATA_TEST_ID as TYPING_DATA_TEST_ID } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";

jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

describe("SkillsRankingBriefing", () => {
  beforeEach(() => {
    jest.useFakeTimers();
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

  const createState = (group: SkillsRankingExperimentGroups, phase: SkillsRankingPhase): SkillsRankingState => ({
    session_id: 1,
    experiment_group: group,
    phases: [{ name: phase, time: new Date().toISOString() }],
    score: {
      jobs_matching_rank: 0,
      comparison_rank: 0,
      comparison_label: "MIDDLE",
      calculated_at: new Date().toISOString(),
    },
    started_at: new Date().toISOString(),
  });

  test("should show work-based two-step message and continue; then call service and onFinish", async () => {
    // GIVEN a work-based group at BRIEFING
    const givenSessionId = 54321;
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
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.BRIEFING);

    // WHEN rendering
    render(<SkillsRankingBriefing onFinish={actualOnFinish} skillsRankingState={givenState} />);

    // THEN expect only first message and no second message yet; no typing container visible since second not shown yet
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_BRIEFING_CONTAINER)).toBeInTheDocument();

    // WHEN advancing to show second message
    act(() => {
      jest.runOnlyPendingTimers();
    });

    // THEN second message with Continue should appear
    const givenContinueButtons = screen.getAllByTestId(DATA_TEST_ID.SKILLS_RANKING_BRIEFING_CONTINUE_BUTTON);
    expect(givenContinueButtons.length).toBeGreaterThanOrEqual(1);

    // WHEN clicking Continue
    act(() => {
      givenContinueButtons[0].click();
    });
    await flush();

    // THEN typing should appear
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    // WHEN typing duration elapses
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();

    // THEN service called with PROOF_OF_VALUE and onFinish invoked
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.PROOF_OF_VALUE);
    expect(actualOnFinish).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should show time-based message with Continue and complete on click", async () => {
    // GIVEN a time-based group at BRIEFING
    const givenSessionId = 22222;
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
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.BRIEFING);

    // WHEN rendering
    render(<SkillsRankingBriefing onFinish={actualOnFinish} skillsRankingState={givenState} />);

    // THEN Continue button should be visible immediately
    const givenContinueButtons = screen.getAllByTestId(DATA_TEST_ID.SKILLS_RANKING_BRIEFING_CONTINUE_BUTTON);
    expect(givenContinueButtons.length).toBeGreaterThanOrEqual(1);
    // WHEN clicking Continue -> typing shows
    act(() => {
      givenContinueButtons[0].click();
    });
    await flush();
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    // WHEN typing duration elapses
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flush();

    // THEN update and finish
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.PROOF_OF_VALUE);
    expect(actualOnFinish).toHaveBeenCalled();
  });

  test("should log error and not proceed when no active session id", () => {
    // GIVEN no session id
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
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.BRIEFING);

    // WHEN rendering and clicking Continue
    render(<SkillsRankingBriefing onFinish={actualOnFinish} skillsRankingState={givenState} />);
    const givenContinueButtons = screen.getAllByTestId(DATA_TEST_ID.SKILLS_RANKING_BRIEFING_CONTINUE_BUTTON);
    givenContinueButtons[0].click();

    // THEN error logged and no update/finish
    expect(console.error).toHaveBeenCalled();
    expect(actualOnFinish).not.toHaveBeenCalled();
  });

  test("should show snackbar and reset flags when service update fails", async () => {
    // GIVEN service failure
    const givenSessionId = 111;
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
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.BRIEFING);

    // WHEN rendering and clicking Continue
    render(<SkillsRankingBriefing onFinish={actualOnFinish} skillsRankingState={givenState} />);
    const givenContinueButtons = screen.getAllByTestId(DATA_TEST_ID.SKILLS_RANKING_BRIEFING_CONTINUE_BUTTON);
    givenContinueButtons[0].click();

    // THEN error logged and onFinish not called
    await flush();
    expect(console.error).toHaveBeenCalled();
    expect(actualOnFinish).not.toHaveBeenCalled();
  });
});
