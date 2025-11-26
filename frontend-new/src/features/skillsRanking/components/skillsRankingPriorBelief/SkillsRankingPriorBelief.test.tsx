// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, fireEvent, render, screen } from "src/_test_utilities/test-utils";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import SkillsRankingPriorBelief, {
  DATA_TEST_ID,
} from "src/features/skillsRanking/components/skillsRankingPriorBelief/SkillsRankingPriorBelief";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { DATA_TEST_ID as TYPING_DATA_TEST_ID } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { mockBrowserIsOnLine, unmockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";

// Mock framer motion
jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

// Mock the slider
jest.mock("src/features/skillsRanking/components/skillsRankingSlider/SkillsRankingSlider", () => ({
  __esModule: true,
  default: ({ onChange, value, disabled, ...props }: any) => (
    <input
      type="range"
      data-testid={props["data-testid"]}
      aria-label={props["aria-label"]}
      value={value}
      disabled={disabled}
      onChange={(e: any) => onChange(e, Number(e.target.value))}
    />
  ),
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

describe("SkillsRankingPriorBelief", () => {
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

  beforeEach(() => {
    mockBrowserIsOnLine(true);
  });

  afterEach(() => {
    unmockBrowserIsOnLine();
  });

  const createState = (group: SkillsRankingExperimentGroups, phase: SkillsRankingPhase): SkillsRankingState => ({
    session_id: 1234,
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

  test("should submit prior belief and complete the flow on submit click", async () => {
    // GIVEN user at PRIOR_BELIEF
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.PRIOR_BELIEF);
    const givenSessionId = 1234;
    const actualOnFinish = jest.fn().mockResolvedValue(undefined);
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
    render(<SkillsRankingPriorBelief skillsRankingState={givenState} onFinish={actualOnFinish} />);

    // THEN expect the message and slider to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_CONTAINER)).toBeInTheDocument();
    const slider = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SLIDER);
    const submitButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SUBMIT_BUTTON);
    expect(slider).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();

    // WHEN changing the slider value and clicking Submit
    fireEvent.change(slider, { target: { value: 75 } });
    fireEvent.click(submitButton);
    await flush();

    // THEN expect typing indicator to be shown
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing duration elapses
    act(() => {
      jest.runAllTimers();
    });
    await flush();

    // THEN expect updateSkillsRankingState called and onFinish called
    expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL, {
      prior_belief: 75,
    });
    expect(actualOnFinish).toHaveBeenCalled();
    // AND no errors or warnings logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should require editing before enabling submit", () => {
    // GIVEN default state at PRIOR_BELIEF
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_3, SkillsRankingPhase.PRIOR_BELIEF);

    // WHEN rendered
    render(<SkillsRankingPriorBelief skillsRankingState={givenState} onFinish={jest.fn()} />);
    const slider = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SLIDER) as HTMLInputElement;
    const submitButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SUBMIT_BUTTON);

    // THEN button disabled until slider edited
    expect(submitButton).toBeDisabled();
    fireEvent.change(slider, { target: { value: 45 } });
    expect(submitButton).not.toBeDisabled();
  });

  test("should show snackbar error and reset flags on failure to submit", async () => {
    // GIVEN user at PRIOR_BELIEF
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.PRIOR_BELIEF);
    // AND service update failure
    const givenSessionId = 142;
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
    render(<SkillsRankingPriorBelief skillsRankingState={givenState} onFinish={mockOnFinish} />);
    // AND the slider value changed and Submit clicked
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SLIDER), { target: { value: 80 } });
    const submitButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SUBMIT_BUTTON);
    fireEvent.click(submitButton);
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
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.PRIOR_BELIEF);
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
    render(<SkillsRankingPriorBelief skillsRankingState={givenState} onFinish={mockOnFinish} />);
    // AND the slider value changed and Submit clicked
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SLIDER), { target: { value: 25 } });
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SUBMIT_BUTTON));
    await flush();

    // THEN expect no update/finish
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockOnFinish).not.toHaveBeenCalled();
    // AND error to be logged
    expect(console.error).toHaveBeenCalled();
  });

  test("should keep controls disabled when offline", async () => {
    // GIVEN offline context
    mockBrowserIsOnLine(false);
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.PRIOR_BELIEF);
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

    // WHEN rendering and trying to submit
    render(<SkillsRankingPriorBelief skillsRankingState={givenState} onFinish={jest.fn()} />);
    const slider = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SLIDER);
    const submitButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SUBMIT_BUTTON);
    fireEvent.change(slider, { target: { value: 60 } });
    fireEvent.click(submitButton);
    await flush();

    // THEN expect submission blocked and no update calls
    expect(submitButton).toBeDisabled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("should render read-only controls when replaying previous responses", async () => {
    // GIVEN replay state
    const givenState = {
      ...createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL),
      user_responses: { prior_belief_percentile: 55 },
    };
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

    // WHEN rendering the replay view
    render(<SkillsRankingPriorBelief skillsRankingState={givenState} onFinish={jest.fn()} />);
    const slider = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SLIDER) as HTMLInputElement;
    const submitButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_SUBMIT_BUTTON);

    // THEN controls stay read-only and submissions ignored
    expect(slider.disabled).toBe(true);
    expect(submitButton).toBeDisabled();
    fireEvent.click(submitButton);
    await flush();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
