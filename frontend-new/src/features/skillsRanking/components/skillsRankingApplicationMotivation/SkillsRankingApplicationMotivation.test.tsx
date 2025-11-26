// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, fireEvent, render, screen, within } from "src/_test_utilities/test-utils";
import SkillsRankingApplicationMotivation, {
  DATA_TEST_ID,
} from "src/features/skillsRanking/components/skillsRankingApplicationMotivation/SkillsRankingApplicationMotivation";
import { DATA_TEST_ID as TYPING_DATA_TEST_ID } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";

// Mock framer motion
jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div> },
}));

describe("SkillsRankingApplicationMotivation", () => {
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
    applicationWillingness?: { value: number; label: string }
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
    user_responses: applicationWillingness !== undefined ? { application_willingness: applicationWillingness } : {},
  });

  const flush = async () => {
    await act(async () => Promise.resolve());
  };

  test("should submit motivation and call onFinish after typing delay", async () => {
    // GIVEN user at APPLICATION_WILLINGNESS with no existing value
    const givenState = createState(SkillsRankingPhase.APPLICATION_WILLINGNESS, SkillsRankingExperimentGroups.GROUP_2);
    const mockOnFinish = jest.fn().mockResolvedValue(undefined);

    // WHEN the component is rendered
    render(<SkillsRankingApplicationMotivation skillsRankingState={givenState} onFinish={mockOnFinish} />);

    // THEN expect the toggle group and submit button to be displayed
    const toggleGroup = screen.getByTestId(DATA_TEST_ID.TOGGLE_GROUP);
    const submitButton = screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON);
    expect(toggleGroup).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();

    // WHEN the user selects a value
    const button5 = within(toggleGroup).getByRole("button", { name: "Motivated" });
    fireEvent.click(button5);
    // AND clicks the Submit button
    fireEvent.click(submitButton);
    await flush();

    // THEN typing indicator appears
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing finishes
    act(() => {
      jest.runAllTimers();
    });
    await flush();

    // THEN expect onFinish to be called with the selected value
    expect(mockOnFinish).toHaveBeenCalledWith(
      expect.objectContaining({
        user_responses: expect.objectContaining({
          application_willingness: { value: 5, label: "Motivated" },
        }),
      })
    );
    // AND no errors or warnings logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should allow immediate submit when existing value already provided", async () => {
    // GIVEN a component with pre-filled existing value in state
    const givenState = createState(SkillsRankingPhase.APPLICATION_WILLINGNESS, SkillsRankingExperimentGroups.GROUP_2, {
      value: 3,
      label: "Somewhat discouraged",
    });
    const mockOnFinish = jest.fn().mockResolvedValue(undefined);
    // AND the component is rendered
    render(<SkillsRankingApplicationMotivation skillsRankingState={givenState} onFinish={mockOnFinish} />);

    // WHEN a user clicks Submit without changing selection
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
        user_responses: expect.objectContaining({
          application_willingness: { value: 3, label: "Somewhat discouraged" },
        }),
      })
    );
  });

  test("should not submit when in replay (read only)", async () => {
    // GIVEN replay component
    const givenState = createState(SkillsRankingPhase.DISCLOSURE, SkillsRankingExperimentGroups.GROUP_2, {
      value: 4,
      label: "Somewhat motivated",
    });
    const mockOnFinish = jest.fn();
    // AND the component is rendered
    render(<SkillsRankingApplicationMotivation skillsRankingState={givenState} onFinish={mockOnFinish} />);

    // WHEN the user changes the selection and clicks Submit
    const toggleGroup = screen.getByTestId(DATA_TEST_ID.TOGGLE_GROUP);
    const button6 = within(toggleGroup).getByRole("button", { name: "Very motivated" });
    fireEvent.click(button6);
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON));
    await flush();

    // THEN expect no typing indicator shown
    expect(screen.queryByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).not.toBeInTheDocument();
    // AND onFinish not called
    expect(mockOnFinish).not.toHaveBeenCalled();
  });

  test("should not render for GROUP_1", () => {
    // GIVEN user in GROUP_1
    const givenState = createState(SkillsRankingPhase.APPLICATION_WILLINGNESS, SkillsRankingExperimentGroups.GROUP_1);
    const mockOnFinish = jest.fn();

    // WHEN the component is rendered
    const { container } = render(
      <SkillsRankingApplicationMotivation skillsRankingState={givenState} onFinish={mockOnFinish} />
    );

    // THEN component should not render anything
    expect(container.firstChild).toBeNull();
  });
});
