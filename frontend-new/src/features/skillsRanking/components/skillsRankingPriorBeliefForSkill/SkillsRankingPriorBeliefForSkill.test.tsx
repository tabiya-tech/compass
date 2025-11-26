// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, fireEvent, render, screen } from "src/_test_utilities/test-utils";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import SkillsRankingPriorBeliefForSkill, {
  DATA_TEST_ID,
} from "src/features/skillsRanking/components/skillsRankingPriorBeliefForSkill/SkillsRankingPriorBeliefForSkill";
import { DATA_TEST_ID as TYPING_DATA_TEST_ID } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { mockBrowserIsOnLine, unmockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";

// Mock framer motion
jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

// Mock the slider
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

jest.mock("src/features/skillsRanking/hooks/skillsRankingFlowGraph", () => {
  const actual = jest.requireActual("src/features/skillsRanking/hooks/skillsRankingFlowGraph");
  return {
    ...actual,
    getNextPhaseForGroup: jest.fn(actual.getNextPhaseForGroup),
  };
});

describe("SkillsRankingPriorBeliefForSkill", () => {
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
    session_id: 2345,
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

  describe.each([
    { group: SkillsRankingExperimentGroups.GROUP_1, expectedNext: SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT },
    { group: SkillsRankingExperimentGroups.GROUP_2, expectedNext: SkillsRankingPhase.DISCLOSURE },
    { group: SkillsRankingExperimentGroups.GROUP_3, expectedNext: SkillsRankingPhase.DISCLOSURE },
  ])("submit flow for $group", ({ group, expectedNext }) => {
    test("should submit prior belief for skill and complete the flow on submit click", async () => {
      // GIVEN a user at PRIOR_BELIEF_FOR_SKILL
      const givenState = createState(group, SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL);
      const givenSessionId = 1245;
      const mockOnFinish = jest.fn();
      const mockUpdate = jest.fn().mockResolvedValue({} as SkillsRankingState);
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

      // WHEN rendering and submitting a valid value
      render(<SkillsRankingPriorBeliefForSkill skillsRankingState={givenState} onFinish={mockOnFinish} />);
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SLIDER), {
        target: { value: 62 },
      });
      fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SUBMIT_BUTTON));
      await flush();

      // THEN expect typing indicator shown
      expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

      // WHEN typing duration elapses
      act(() => {
        jest.runAllTimers();
      });
      await flush();

      // THEN expect update called with correct params and onFinish called
      expect(mockUpdate).toHaveBeenCalledWith(givenSessionId, expectedNext, { prior_belief_for_skill: 62 });
      expect(mockOnFinish).toHaveBeenCalled();
      // AND no errors or warnings logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  test("should show snackbar error and reset flags on failure to submit", async () => {
    // GIVEN a user at PRIOR_BELIEF_FOR_SKILL
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL);
    const givenSessionId = 55;
    const mockUpdate = jest.fn().mockRejectedValue(new Error("boom"));
    const mockOnFinish = jest.fn();
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

    // WHEN rendering and submitting a valid value
    render(<SkillsRankingPriorBeliefForSkill skillsRankingState={givenState} onFinish={mockOnFinish} />);
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SLIDER), {
      target: { value: 80 },
    });
    const submitButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SUBMIT_BUTTON);
    fireEvent.click(submitButton);
    await flush();

    // THEN expect snackbar error shown
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
      "Failed to update skills ranking state. Please try again later.",
      { variant: "error" }
    );
    // AND onFinish not called
    expect(mockOnFinish).not.toHaveBeenCalled();
    // AND the error is logged
    expect(console.error).toHaveBeenCalled();
  });

  test("should log error and not proceed when no active session id", async () => {
    // GIVEN no session id
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL);
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

    // WHEN rendering and submitting a valid value
    render(<SkillsRankingPriorBeliefForSkill skillsRankingState={givenState} onFinish={mockOnFinish} />);
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SLIDER), {
      target: { value: 25 },
    });
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SUBMIT_BUTTON));
    await flush();

    // THEN expect no update/finish
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockOnFinish).not.toHaveBeenCalled();
    // AND error to be logged
    expect(console.error).toHaveBeenCalled();
  });

  test("should require editing before enabling submit", () => {
    // GIVEN default state at PRIOR_BELIEF_FOR_SKILL
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_1, SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL);

    // WHEN rendered
    render(<SkillsRankingPriorBeliefForSkill skillsRankingState={givenState} onFinish={jest.fn()} />);

    const slider = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SLIDER) as HTMLInputElement;
    const submitButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SUBMIT_BUTTON);

    // THEN submit disabled until slider changed
    expect(submitButton).toBeDisabled();
    fireEvent.change(slider, { target: { value: 33 } });
    expect(submitButton).not.toBeDisabled();
  });

  test("should not submit when offline", async () => {
    // GIVEN offline context
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_2, SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL);
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

    mockBrowserIsOnLine(false);

    // WHEN rendering offline and trying to submit
    render(<SkillsRankingPriorBeliefForSkill skillsRankingState={givenState} onFinish={jest.fn()} />);
    const slider = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SLIDER);
    const submitButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SUBMIT_BUTTON);
    fireEvent.change(slider, { target: { value: 44 } });
    fireEvent.click(submitButton);
    await flush();

    // THEN expect no update call while offline
    expect(submitButton).toBeDisabled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("should log error when next phase is unavailable", async () => {
    // GIVEN state where flow graph returns undefined
    const givenState = createState(SkillsRankingExperimentGroups.GROUP_3, SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL);
    const flowGraph = jest.requireMock("src/features/skillsRanking/hooks/skillsRankingFlowGraph");
    flowGraph.getNextPhaseForGroup.mockReturnValueOnce(undefined);
    const mockUpdate = jest.fn();
    const mockOnFinish = jest.fn();
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({ getActiveSessionId: () => 5 } as any);
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

    // WHEN submit is attempted
    render(<SkillsRankingPriorBeliefForSkill skillsRankingState={givenState} onFinish={mockOnFinish} />);
    const slider = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SLIDER);
    fireEvent.change(slider, { target: { value: 70 } });
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PRIOR_BELIEF_FOR_SKILL_SUBMIT_BUTTON));
    await flush();

    // THEN expect an error and no follow-up actions
    expect(console.error).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockOnFinish).not.toHaveBeenCalled();
  });
});
