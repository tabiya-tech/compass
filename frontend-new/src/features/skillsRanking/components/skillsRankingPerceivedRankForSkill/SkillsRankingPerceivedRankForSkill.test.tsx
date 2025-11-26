// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, fireEvent, render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingPerceivedRankForSkill, {
  DATA_TEST_ID,
} from "src/features/skillsRanking/components/skillsRankingPerceivedRankForSkill/SkillsRankingPerceivedRankForSkill";
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

describe("SkillsRankingPerceivedRankForSkill", () => {
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

  test("should submit perceived rank for least demanded skill and complete the flow on submit", async () => {
    // GIVEN component is rendered
    const mockOnSubmit = jest.fn();
    render(
      <SkillsRankingPerceivedRankForSkill
        isReadOnly={false}
        leastDemandedLabel="foo bar"
        sentAt={new Date().toISOString()}
        onSubmit={mockOnSubmit}
      />
    );

    // WHEN slider changed
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_SLIDER), {
      target: { value: 47 },
    });
    // AND the Submit clicked
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_SUBMIT_BUTTON));

    // THEN typing indicator is shown
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing finishes
    act(() => jest.runAllTimers());
    await flush();

    // THEN onSubmit called with value
    expect(mockOnSubmit).toHaveBeenCalledWith(47);
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should allow immediate submit when defaultValue provided (>0)", async () => {
    // GIVEN component is rendered with default value
    const mockOnSubmit = jest.fn();
    render(
      <SkillsRankingPerceivedRankForSkill
        isReadOnly={false}
        leastDemandedLabel="Skill Y"
        sentAt={new Date().toISOString()}
        defaultValue={65}
        onSubmit={mockOnSubmit}
      />
    );

    // WHEN the Submit clicked without changing the slider
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_SUBMIT_BUTTON));

    // THEN typing indicator is shown
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    act(() => jest.runAllTimers());
    await flush();

    // THEN onSubmit called with default value
    expect(mockOnSubmit).toHaveBeenCalledWith(65);
  });

  test("should not submit when read only", async () => {
    // GIVEN component is rendered in read-only mode
    const mockOnSubmit = jest.fn();
    render(
      <SkillsRankingPerceivedRankForSkill
        isReadOnly={true}
        leastDemandedLabel="Skill Y"
        sentAt={new Date().toISOString()}
        defaultValue={40}
        onSubmit={mockOnSubmit}
      />
    );

    // WHEN slider changed
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_SLIDER), {
      target: { value: 70 },
    });
    // AND the Submit clicked
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_FOR_SKILL_SUBMIT_BUTTON));
    await flush();

    // THEN typing indicator isn't shown
    expect(screen.queryByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).not.toBeInTheDocument();
    // AND onSubmit not called
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
