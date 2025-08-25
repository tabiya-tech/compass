// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingPrompt, { DATA_TEST_ID } from "./SkillsRankingPrompt";
import { SkillsRankingPhase, SkillsRankingState } from "src/features/skillsRanking/types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { DATA_TEST_ID as TYPING_DATA_TEST_ID } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";

// Global mocks: animations only
jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

describe("SkillsRankingPrompt", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // jsdom: mock scrollIntoView used by useAutoScrollOnChange
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const flushMicrotasks = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  const createState = (phase: SkillsRankingPhase): SkillsRankingState => ({
    session_id: 1,
    experiment_group: 0 as any,
    phases: [{ name: phase, time: new Date().toISOString() }],
    score: {
      jobs_matching_rank: 0,
      comparison_rank: 0,
      comparison_label: "MIDDLE",
      calculated_at: new Date().toISOString(),
    },
    started_at: new Date().toISOString(),
  });

  test("should go through steps and call onFinish on completion (non-replay)", async () => {
    // GIVEN an initial phase state
    const mockUpdateSkillsRankingState = jest.fn().mockResolvedValue({} as SkillsRankingState);
    const givenSessionId = 98765;
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdateSkillsRankingState,
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
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
      getActiveSessionId: () => givenSessionId,
    } as unknown as UserPreferencesStateService);
    const actualOnFinish = jest.fn().mockResolvedValue(undefined);
    const givenState = createState(SkillsRankingPhase.INITIAL);
    const givenComponent = <SkillsRankingPrompt onFinish={actualOnFinish} skillsRankingState={givenState} />;

    // WHEN rendering and advancing timers through all steps
    render(givenComponent);

    // THEN expect the first step to show typing and no main message yet
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.MAIN_MESSAGE_CONTAINER)).not.toBeInTheDocument();

    // WHEN advancing to SHOW_MESSAGE
    act(() => {
      jest.runOnlyPendingTimers();
    });
    // THEN expect the main message to appear and typing to be gone
    expect(screen.getByTestId(DATA_TEST_ID.MAIN_MESSAGE_CONTAINER)).toBeInTheDocument();
    expect(screen.queryByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).not.toBeInTheDocument();

    // WHEN advancing to FINAL_TYPING
    act(() => {
      jest.runOnlyPendingTimers();
    });
    // THEN expect typing to be shown again (final typing) while main message remains
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.MAIN_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN advancing to COMPLETED
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flushMicrotasks();

    // THEN expect service to be called to advance to BRIEFING and onFinish invoked
    expect(mockUpdateSkillsRankingState).toHaveBeenCalledTimes(1);
    expect(mockUpdateSkillsRankingState).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.BRIEFING);
    expect(actualOnFinish).toHaveBeenCalledTimes(1);
    // AND expect final typing to be removed; main message remains
    expect(screen.queryByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).not.toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.MAIN_MESSAGE_CONTAINER)).toBeInTheDocument();

    // AND expect no console errors/warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should render replay view without advancing state (replay)", () => {
    // GIVEN a non-initial phase (replay)
    const givenState = createState(SkillsRankingPhase.BRIEFING);
    const givenComponent = <SkillsRankingPrompt onFinish={jest.fn()} skillsRankingState={givenState} />;

    // WHEN rendering
    render(givenComponent);

    // THEN expect replay container to be visible
    expect(screen.getByTestId(DATA_TEST_ID.REPLAY_CONTAINER)).toBeInTheDocument();
    // AND expect main message/typing wrappers from non-replay path to not render
    expect(screen.queryByTestId(DATA_TEST_ID.MAIN_MESSAGE_CONTAINER)).not.toBeInTheDocument();
    expect(screen.queryByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).not.toBeInTheDocument();

    // AND expect no console errors/warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should show error snackbar and not throw when service update fails", async () => {
    // GIVEN failing service update and initial phase
    const mockUpdateSkillsRankingState = jest.fn().mockRejectedValueOnce(new Error("boom"));
    const givenSessionId = 13579;
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdateSkillsRankingState,
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
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
      getActiveSessionId: () => givenSessionId,
    } as unknown as UserPreferencesStateService);
    const actualOnFinish = jest.fn().mockResolvedValue(undefined);
    const givenState = createState(SkillsRankingPhase.INITIAL);

    // WHEN rendering and progressing through steps
    render(<SkillsRankingPrompt onFinish={actualOnFinish} skillsRankingState={givenState} />);
    // initial typing visible
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    // to SHOW_MESSAGE
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(screen.getByTestId(DATA_TEST_ID.MAIN_MESSAGE_CONTAINER)).toBeInTheDocument();
    expect(screen.queryByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).not.toBeInTheDocument();
    // to FINAL_TYPING
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    // to COMPLETED + handleAdvanceState
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await flushMicrotasks();

    // THEN expect onFinish not to be called because state update failed
    expect(actualOnFinish).not.toHaveBeenCalled();
    // AND expect console.error to have been called by the component
    expect(console.error).toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should not advance when no active session id", async () => {
    // GIVEN initial phase but no active session id
    const mockUpdateSkillsRankingState = jest.fn();
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdateSkillsRankingState,
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
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
      getActiveSessionId: () => null,
    } as unknown as UserPreferencesStateService);
    const actualOnFinish = jest.fn().mockResolvedValue(undefined);
    const givenState = createState(SkillsRankingPhase.INITIAL);

    // WHEN rendering and progressing through steps to completion
    render(<SkillsRankingPrompt onFinish={actualOnFinish} skillsRankingState={givenState} />);
    // to SHOW_MESSAGE
    act(() => {
      jest.runOnlyPendingTimers();
    });
    // to FINAL_TYPING
    act(() => {
      jest.runOnlyPendingTimers();
    });
    // THEN expect neither service nor onFinish to be called (we stop before final transition)
    expect(mockUpdateSkillsRankingState).not.toHaveBeenCalled();
    expect(actualOnFinish).not.toHaveBeenCalled();
    // AND expect final typing step is showing (we haven't completed)
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("snapshot: initial render in INITIAL phase (non-replay)", () => {
    const givenSessionId = 222;
    const mockUpdateSkillsRankingState = jest.fn();
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdateSkillsRankingState,
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
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
      getActiveSessionId: () => givenSessionId,
    } as unknown as UserPreferencesStateService);
    const givenState = createState(SkillsRankingPhase.INITIAL);
    const { container } = render(<SkillsRankingPrompt onFinish={jest.fn()} skillsRankingState={givenState} />);
    expect(container).toMatchSnapshot();
  });
});
