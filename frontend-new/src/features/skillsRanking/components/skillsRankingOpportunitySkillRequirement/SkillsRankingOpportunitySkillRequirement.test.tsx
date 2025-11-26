// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, fireEvent, render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingOpportunitySkillRequirement, {
  DATA_TEST_ID,
} from "src/features/skillsRanking/components/skillsRankingOpportunitySkillRequirement/SkillsRankingOpportunitySkillRequirement";
import { DATA_TEST_ID as TYPING_DATA_TEST_ID } from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";

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

describe("SkillsRankingOpportunitySkillRequirement", () => {
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

  test("should submit opportunity skill requirement and complete the flow on submit", async () => {
    // GIVEN component is rendered
    const mockOnSubmit = jest.fn();
    render(
      <SkillsRankingOpportunitySkillRequirement
        isReadOnly={false}
        mostDemandedLabel="foo baz"
        sentAt={new Date().toISOString()}
        onSubmit={mockOnSubmit}
      />
    );

    // WHEN slider changed
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_SLIDER), {
      target: { value: 31 },
    });
    // AND the Submit clicked
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_SUBMIT_BUTTON));
    await flush();

    // THEN typing indicator visible
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing finishes
    act(() => jest.runAllTimers());
    await flush();

    // THEN onSubmit called with value
    expect(mockOnSubmit).toHaveBeenCalledWith(31);
    // AND no errors or warnings logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should allow submit immediately when defaultValue provided", async () => {
    // GIVEN component with defaultValue is rendered
    const mockOnSubmit = jest.fn();
    render(
      <SkillsRankingOpportunitySkillRequirement
        isReadOnly={false}
        mostDemandedLabel="foo baz"
        sentAt={new Date().toISOString()}
        defaultValue={75}
        onSubmit={mockOnSubmit}
      />
    );

    // WHEN clicking submitting without editing
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_SUBMIT_BUTTON));
    await flush();

    // THEN typing indicator appears
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing finishes
    act(() => jest.runAllTimers());
    await flush();

    // THEN submit with default value
    expect(mockOnSubmit).toHaveBeenCalledWith(75);
  });

  test("should not submit when read only", async () => {
    // GIVEN read-only component
    const mockOnSubmit = jest.fn();
    render(
      <SkillsRankingOpportunitySkillRequirement
        isReadOnly={true}
        mostDemandedLabel="foo baz"
        sentAt={new Date().toISOString()}
        defaultValue={40}
        onSubmit={mockOnSubmit}
      />
    );

    // WHEN changing the slider and clicking Submit
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_SLIDER), {
      target: { value: 70 },
    });
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_OPPORTUNITY_SKILL_REQUIREMENT_SUBMIT_BUTTON));
    await flush();

    // THEN typing indicator isn't shown
    expect(screen.queryByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).not.toBeInTheDocument();
    // AND onSubmit not called
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
