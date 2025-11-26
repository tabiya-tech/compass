// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, fireEvent, render, screen } from "src/_test_utilities/test-utils";
import { DATA_TEST_ID as TYPING_DATA_TEST_ID } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import SkillsRankingApplication24h, {
  DATA_TEST_ID,
} from "src/features/skillsRanking/components/skillsRankingApplication24h/SkillsRankingApplication24h";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

// Mock framer motion
jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

// Mock the slider
jest.mock("@mui/material", () => {
  const actual = jest.requireActual("@mui/material");
  return {
    ...actual,
    Slider: ({ value, onChange, min, max, step, ...props }: any) => (
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        data-testid={props["data-testid"]}
        aria-label={props["aria-label"]}
        onChange={(e) => onChange(e, Number(e.target.value))}
      />
    ),
  };
});

describe("SkillsRankingApplication24h", () => {
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

  const createState = (
    phase: SkillsRankingPhase,
    group: SkillsRankingExperimentGroups,
    application24h?: number
  ): SkillsRankingState => ({
    session_id: 1234,
    metadata: {
      experiment_group: group,
      started_at: new Date().toISOString(),
    },
    phase: [{ name: phase, time: new Date().toISOString() }],
    score: {
      above_average_labels: [],
      below_average_labels: [],
      most_demanded_label: "x",
      most_demanded_percent: 0,
      least_demanded_label: "y",
      least_demanded_percent: 0,
      average_percent_for_jobseeker_skill_groups: 0,
      average_count_for_jobseeker_skill_groups: 0,
      province_used: "P",
      matched_skill_groups: 0,
      calculated_at: new Date().toISOString(),
    },
    user_responses: application24h !== undefined ? { application_24h: application24h } : {},
  });

  const flush = async () => {
    await act(async () => Promise.resolve());
  };

  test("should submit application hours and complete the flow on submit click", async () => {
    // GIVEN user at APPLICATION_24H with no existing value
    const givenState = createState(SkillsRankingPhase.APPLICATION_24H, SkillsRankingExperimentGroups.GROUP_2, 0);
    const givenSessionId = 1334;
    const OnFinish = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(UserPreferencesStateService, "getInstance")
      .mockReturnValue({ getActiveSessionId: () => givenSessionId } as any);

    // WHEN the component is rendered
    render(<SkillsRankingApplication24h skillsRankingState={givenState} onFinish={OnFinish} />);

    // THEN expect the message and slider to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toBeInTheDocument();
    const slider = screen.getByTestId(DATA_TEST_ID.SLIDER) as HTMLInputElement;
    const submitButton = screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON);
    expect(slider).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();

    // WHEN the user changes the slider and submits
    fireEvent.change(slider, { target: { value: 6 } });
    fireEvent.click(submitButton);
    await flush();

    // THEN typing indicator should appear
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing duration elapses
    act(() => {
      jest.runAllTimers();
    });
    await flush();

    // THEN expect onFinish should be called
    expect(OnFinish).toHaveBeenCalled();
    // AND no errors or warnings logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should allow immediate submit when existing value already provided (>0)", async () => {
    // GIVEN a component with pre-filled existing value in state
    const givenState = createState(SkillsRankingPhase.APPLICATION_24H, SkillsRankingExperimentGroups.GROUP_2, 4);
    const mockOnFinish = jest.fn().mockResolvedValue(undefined);

    // WHEN the component is rendered
    render(<SkillsRankingApplication24h skillsRankingState={givenState} onFinish={mockOnFinish} />);
    // AND the user clicks submit without moving the slider
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON));
    await flush();

    // THEN typing indicator appears
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing finishes
    act(() => {
      jest.runAllTimers();
    });
    await flush();

    // THEN onFinish called with existing value
    expect(mockOnFinish).toHaveBeenCalledWith(
      expect.objectContaining({
        user_responses: expect.objectContaining({ application_24h: 4 }),
      })
    );
  });

  test("should not submit when in replay (read only)", async () => {
    // GIVEN replay component
    const givenState = createState(SkillsRankingPhase.DISCLOSURE, SkillsRankingExperimentGroups.GROUP_1, 4);
    const mockOnFinish = jest.fn();

    // WHEN the component is rendered
    render(<SkillsRankingApplication24h skillsRankingState={givenState} onFinish={mockOnFinish} />);

    // WHEN attempting to change slider
    const slider = screen.getByTestId(DATA_TEST_ID.SLIDER) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "10" } });
    // AND clicking submit
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON));
    await flush();

    // THEN expect no typing indicator shown
    expect(screen.queryByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).not.toBeInTheDocument();
    // AND onFinish not called
    expect(mockOnFinish).not.toHaveBeenCalled();
  });
});
