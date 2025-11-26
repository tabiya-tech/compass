// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, fireEvent, render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingProofOfValueIntro, {
  DATA_TEST_ID,
} from "src/features/skillsRanking/components/skillsRankingProofOfValueIntro/SkillsRankingProofOfValueIntro";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { DATA_TEST_ID as TYPING_DATA_TEST_ID } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { mockBrowserIsOnLine, unmockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";

// Mock framer motion
jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

// Mock the snackbar provider
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      enqueueSnackbar: jest.fn(),
      closeSnackbar: jest.fn(),
    }),
  };
});

describe("SkillsRankingProofOfValueIntro", () => {
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

  const createState = (group: SkillsRankingExperimentGroups, phase: SkillsRankingPhase): SkillsRankingState => ({
    session_id: 123,
    metadata: {
      experiment_group: group,
      started_at: new Date().toISOString(),
    },
    phase: [{ name: phase, time: new Date().toISOString() }],
    score: {
      above_average_labels: [],
      below_average_labels: [],
      most_demanded_label: "test",
      most_demanded_percent: 0,
      least_demanded_label: "test",
      least_demanded_percent: 0,
      average_percent_for_jobseeker_skill_groups: 0,
      average_count_for_jobseeker_skill_groups: 0,
      province_used: "test",
      matched_skill_groups: 0,
      calculated_at: new Date().toISOString(),
    },
    user_responses: {},
  });

  const flush = async () => {
    await act(async () => Promise.resolve());
  };

  beforeEach(() => {
    mockBrowserIsOnLine(true);
  });

  afterEach(() => {
    unmockBrowserIsOnLine();
  });

  test("should display the proof of value intro message and complete flow on Continue click", async () => {
    // GIVEN any group user at PROOF_OF_VALUE_INTRO
    const givenSessionId = 123;
    const mockOnFinish = jest.fn().mockResolvedValue(undefined);
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.PROOF_OF_VALUE_INTRO);
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

    // WHEN the component is rendered
    render(<SkillsRankingProofOfValueIntro onFinish={mockOnFinish} skillsRankingState={givenState} />);

    // THEN the proof of value intro message is displayed
    expect(screen.getByTestId(DATA_TEST_ID.PROOF_OF_VALUE_INTRO_CONTAINER)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.PROOF_OF_VALUE_INTRO_CONTINUE_BUTTON)).toBeInTheDocument();

    // WHEN the Continue button is clicked
    const continueButton = screen.getByTestId(DATA_TEST_ID.PROOF_OF_VALUE_INTRO_CONTINUE_BUTTON);
    act(() => {
      continueButton.click();
    });
    await flush();

    // THEN expect typing indicator to be shown
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing duration elapses
    act(() => {
      jest.runAllTimers();
    });
    await flush();

    // THEN the service called with PROOF_OF_VALUE and onFinish invoked
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.PROOF_OF_VALUE);
    expect(mockOnFinish).toHaveBeenCalled();
    // AND no errors or warnings logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should show snackbar error and reset flags on failure to continue", async () => {
    // GIVEN user at PROOF_OF_VALUE_INTRO
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.PROOF_OF_VALUE_INTRO);
    // AND service update failure
    const givenSessionId = 123;
    jest
      .spyOn(UserPreferencesStateService, "getInstance")
      .mockReturnValue({ getActiveSessionId: () => givenSessionId } as any);
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
    const mockOnFinish = jest.fn();

    // WHEN rendering and clicking Continue
    render(<SkillsRankingProofOfValueIntro onFinish={mockOnFinish} skillsRankingState={givenState} />);
    const continueButton = screen.getByTestId(DATA_TEST_ID.PROOF_OF_VALUE_INTRO_CONTINUE_BUTTON);
    fireEvent.click(continueButton);

    // THEN expect snackbar error shown
    await flush();
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to continue. Please try again later.", {
      variant: "error",
    });
    // AND onFinish not called
    expect(mockOnFinish).not.toHaveBeenCalled();
    // AND the error is logged
    expect(console.error).toHaveBeenCalled();
  });

  test("should log error and not proceed when no active session id", () => {
    // GIVEN no session id
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => null } as any);
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
    const mockOnFinish = jest.fn();
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.PROOF_OF_VALUE_INTRO);

    // WHEN rendering and clicking Continue
    render(<SkillsRankingProofOfValueIntro onFinish={mockOnFinish} skillsRankingState={givenState} />);
    const givenContinueButton = screen.getByTestId(DATA_TEST_ID.PROOF_OF_VALUE_INTRO_CONTINUE_BUTTON);
    fireEvent.click(givenContinueButton);

    // THEN expect no update/finish
    expect(mockOnFinish).not.toHaveBeenCalled();
    // AND error to be logged
    expect(console.error).toHaveBeenCalled();
  });

  test("should keep Continue disabled when offline or replaying", () => {
    // GIVEN offline user
    const offlineState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.PROOF_OF_VALUE_INTRO);
    mockBrowserIsOnLine(false);
    const { rerender } = render(<SkillsRankingProofOfValueIntro onFinish={jest.fn()} skillsRankingState={offlineState} />);
    expect(screen.getByTestId(DATA_TEST_ID.PROOF_OF_VALUE_INTRO_CONTINUE_BUTTON)).toBeDisabled();

    // WHEN user replays a completed phase
    mockBrowserIsOnLine(true);
    const replayState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.PROOF_OF_VALUE);
    rerender(<SkillsRankingProofOfValueIntro onFinish={jest.fn()} skillsRankingState={replayState} />);
    expect(screen.getByTestId(DATA_TEST_ID.PROOF_OF_VALUE_INTRO_CONTINUE_BUTTON)).toBeDisabled();
  });

  test("should keep typing indicator visible until typing duration elapses", async () => {
    // GIVEN valid state and timers
    const givenSessionId = 321;
    const mockOnFinish = jest.fn();
    const mockUpdate = jest.fn().mockResolvedValue({} as SkillsRankingState);
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => givenSessionId } as any);
    jest.spyOn(SkillsRankingService, "getInstance").mockReturnValue({
      updateSkillsRankingState: mockUpdate,
      getConfig: () => ({
        config: {
          compensationAmount: "$1",
          jobPlatformUrl: "x",
          shortTypingDurationMs: 1,
          defaultTypingDurationMs: 50,
          longTypingDurationMs: 1,
        },
      }),
    } as unknown as SkillsRankingService);
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.PROOF_OF_VALUE_INTRO);

    // WHEN submitting and waiting through typing duration
    render(<SkillsRankingProofOfValueIntro onFinish={mockOnFinish} skillsRankingState={givenState} />);
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.PROOF_OF_VALUE_INTRO_CONTINUE_BUTTON));
    await flush();

    // THEN typing indicator shown
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(49);
    });
    await flush();
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();
    expect(mockOnFinish).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    await flush();
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.PROOF_OF_VALUE);
    expect(mockOnFinish).toHaveBeenCalled();
    expect(screen.queryByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).not.toBeInTheDocument();
  });
});
