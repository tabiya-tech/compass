// mute the console (consistent with other tests)
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, fireEvent, render, screen } from "src/_test_utilities/test-utils";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import SkillsRankingDisclosure, {
  DATA_TEST_ID,
} from "src/features/skillsRanking/components/skillsRankingDisclosure/SkillsRankingDisclosure";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { DATA_TEST_ID as TYPING_DATA_TEST_ID } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";

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

describe("SkillsRankingDisclosure", () => {
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
    session_id: 12345,
    metadata: { experiment_group: group, started_at: new Date().toISOString() },
    phase: [{ name: phase, time: new Date().toISOString() }],
    score: {
      above_average_labels: ["A", "B"],
      below_average_labels: ["C", "D"],
      most_demanded_label: "MostSkill",
      most_demanded_percent: 0,
      least_demanded_label: "LeastSkill",
      least_demanded_percent: 0,
      average_percent_for_jobseeker_skill_groups: 0,
      average_count_for_jobseeker_skill_groups: 0,
      province_used: "Province",
      matched_skill_groups: 0,
      calculated_at: new Date().toISOString(),
    },
    user_responses: {},
  });

  const flush = async () => {
    await act(async () => Promise.resolve());
  };

  test("should show disclosure message and call onFinish for GROUP_1", async () => {
    // GIVEN user at DISCLOSURE in GROUP_1
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.DISCLOSURE);
    const givenSessionId = 1233;
    const mockOnFinish = jest.fn().mockResolvedValue(undefined);
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
    render(<SkillsRankingDisclosure skillsRankingState={givenState} onFinish={mockOnFinish} />);

    // THEN expect initial typing to be shown
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing finishes
    act(() => {
      jest.runAllTimers();
    });
    await flush();

    // THEN no ready message should be shown
    expect(screen.queryByText(/Great, the information is now ready:/i)).not.toBeInTheDocument();

    // AND expect the disclosure container and continue button to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTAINER)).toBeInTheDocument();
    const continueButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTINUE_BUTTON);
    expect(continueButton).toBeInTheDocument();

    // WHEN clicking continues
    fireEvent.click(continueButton);
    await flush();

    // THEN typing indicator appears
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing finishes
    act(() => {
      jest.runAllTimers();
    });
    await flush();

    // THEN expect updateSkillsRankingState called with COMPLETED phase
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.COMPLETED);
    expect(mockOnFinish).toHaveBeenCalled();
    // AND no errors or warnings logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should show disclosure message and call onFinish for GROUP_2", async () => {
    // GIVEN user at DISCLOSURE in GROUP_2
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.DISCLOSURE);
    const givenSessionId = 1234;
    const mockOnFinish = jest.fn().mockResolvedValue(undefined);
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
    render(<SkillsRankingDisclosure skillsRankingState={givenState} onFinish={mockOnFinish} />);

    // THEN expect initial typing to be shown
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing finishes
    act(() => {
      jest.runAllTimers();
    });
    await flush();

    // THEN expect the ready message to be shown
    expect(screen.getByText(/Great, the information is now ready:/i)).toBeInTheDocument();
    // AND expect the disclosure container and continue button to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTAINER)).toBeInTheDocument();
    const continueButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTINUE_BUTTON);
    expect(continueButton).toBeInTheDocument();

    // WHEN the user clicks continue
    fireEvent.click(continueButton);
    await flush();

    // THEN typing indicator appears
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing finishes
    act(() => {
      jest.runAllTimers();
    });
    await flush();

    // THEN expect updateSkillsRankingState to be called
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.APPLICATION_WILLINGNESS);
    expect(mockOnFinish).toHaveBeenCalled();
    // AND no errors or warnings logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should market disclosure message and call onFinish for GROUP_3", async () => {
    // GIVEN user at DISCLOSURE in GROUP_3
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_3, SkillsRankingPhase.DISCLOSURE);
    const givenSessionId = 5678;
    const mockOnFinish = jest.fn().mockResolvedValue(undefined);
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
    render(<SkillsRankingDisclosure skillsRankingState={givenState} onFinish={mockOnFinish} />);

    // THEN expect initial typing to be shown
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing finishes
    act(() => {
      jest.runAllTimers();
    });
    await flush();

    // THEN expect the ready message should be shown
    expect(screen.getByText(/Great, the information is now ready:/i)).toBeInTheDocument();
    // AND expect the disclosure container and continue button to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTAINER)).toBeInTheDocument();
    const continueButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTINUE_BUTTON);
    expect(continueButton).toBeInTheDocument();

    // WHEN Continue is clicked
    fireEvent.click(continueButton);
    await flush();

    // THEN typing indicator appears
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing finishes
    act(() => {
      jest.runAllTimers();
    });
    await flush();

    // THEN expect updateSkillsRankingState to be called
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.APPLICATION_WILLINGNESS);
    expect(mockOnFinish).toHaveBeenCalled();
    // AND no errors or warnings logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should show snackbar error and reset flags on failure to submit", async () => {
    // GIVEN user at DISCLOSURE
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.DISCLOSURE);
    // AND service update failure
    const givenSessionId = 1422;
    const mockOnFinish = jest.fn();
    const mockUpdate = jest.fn().mockRejectedValue(new Error("boom"));
    jest
      .spyOn(UserPreferencesStateService, "getInstance")
      .mockReturnValue({ getActiveSessionId: () => givenSessionId } as any);
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

    // WHEN the component is rendered
    render(<SkillsRankingDisclosure skillsRankingState={givenState} onFinish={mockOnFinish} />);
    // AND typing finishes and disclosure is shown
    act(() => {
      jest.runAllTimers();
    });
    await flush();
    // AND continue is clicked
    const continueButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTINUE_BUTTON);
    fireEvent.click(continueButton);
    await flush();

    // THEN expect the snackbar error to be shown
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
      "Failed to update skills ranking state. Please try again later.",
      { variant: "error" }
    );
    // AND onFinish not called
    expect(mockOnFinish).not.toHaveBeenCalled();
    // AND the error to be logged
    expect(console.error).toHaveBeenCalled();
  });

  test("should log error and not proceed when no active session id", async () => {
    // GIVEN no session id
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.DISCLOSURE);
    const mockOnFinish = jest.fn();
    const mockUpdate = jest.fn();
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => null } as any);
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

    // WHEN the component is rendered
    render(<SkillsRankingDisclosure skillsRankingState={givenState} onFinish={mockOnFinish} />);

    // WHEN typing finishes
    act(() => {
      jest.runAllTimers();
    });
    await flush();

    // AND continue is clicked
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTINUE_BUTTON));
    await flush();

    // THEN expect no update/finish
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockOnFinish).not.toHaveBeenCalled();
    // AND error to be logged
    expect(console.error).toHaveBeenCalled();
  });

  test("should not submit when in replay (read only)", async () => {
    // GIVEN replay component
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.PRIOR_BELIEF);
    const mockOnFinish = jest.fn();
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

    // WHEN the component is rendered
    render(<SkillsRankingDisclosure skillsRankingState={givenState} onFinish={mockOnFinish} />);

    // THEN disclosure shown immediately (replay mode)
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTAINER)).toBeInTheDocument();
    // AND ready message shown for GROUP_2
    expect(screen.getByText(/Great, the information is now ready:/i)).toBeInTheDocument();

    // WHEN attempting to click continue
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTINUE_BUTTON));
    await flush();

    // THEN no update and no finish
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockOnFinish).not.toHaveBeenCalled();
  });

  test("should show disclosure immediately in replay mode for GROUP_1 without ready message", async () => {
    // GIVEN replay component for GROUP_1
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.COMPLETED);
    const mockOnFinish = jest.fn();
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

    // WHEN the component is rendered
    render(<SkillsRankingDisclosure skillsRankingState={givenState} onFinish={mockOnFinish} />);

    // THEN disclosure shown immediately
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTAINER)).toBeInTheDocument();
    // AND no ready message for GROUP_1 in replay
    expect(screen.queryByText(/Great, the information is now ready:/i)).not.toBeInTheDocument();
  });

  test("should go through correct scroll steps for GROUP_1 skipping ready message", async () => {
    // GIVEN user at DISCLOSURE in GROUP_1
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.DISCLOSURE);
    const givenSessionId = 12234;
    const mockOnFinish = jest.fn().mockResolvedValue(undefined);
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
    render(<SkillsRankingDisclosure skillsRankingState={givenState} onFinish={mockOnFinish} />);

    // THEN initial typing shown
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN first typing finishes
    act(() => {
      jest.advanceTimersByTime(1);
    });
    await flush();

    // THEN no ready message shown (GROUP_1 skips it)
    expect(screen.queryByText(/Great, the information is now ready:/i)).not.toBeInTheDocument();
    // AND typing before disclosure shown
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN that typing finishes
    act(() => {
      jest.runAllTimers();
    });
    await flush();

    // THEN disclosure shown
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_DISCLOSURE_CONTINUE_BUTTON)).toBeInTheDocument();
  });
});
