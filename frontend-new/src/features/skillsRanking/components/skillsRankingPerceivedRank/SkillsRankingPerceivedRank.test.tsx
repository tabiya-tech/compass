// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, fireEvent, render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingPerceivedRank, {
  DATA_TEST_ID,
} from "src/features/skillsRanking/components/skillsRankingPerceivedRank/SkillsRankingPerceivedRank";
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

describe("SkillsRankingPerceivedRank", () => {
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

  test("should submit perceived rank and complete the flow on submit", async () => {
    // GIVEN component is rendered
    const mockOnSubmit = jest.fn();
    render(
      <SkillsRankingPerceivedRank
        isReadOnly={false}
        mostDemandedLabel="foo"
        sentAt={new Date().toISOString()}
        onSubmit={mockOnSubmit}
      />
    );

    // WHEN slider changed
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SLIDER), { target: { value: 73 } });
    // AND the Submit clicked
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON));

    // THEN typing indicator visible
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing finishes
    act(() => jest.runAllTimers());

    // THEN onSubmit called with value
    expect(mockOnSubmit).toHaveBeenCalledWith(73);
    // AND no errors or warnings logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should allow submit immediately when defaultValue provided", async () => {
    // GIVEN component with defaultValue is rendered
    const mockOnSubmit = jest.fn();
    render(
      <SkillsRankingPerceivedRank
        isReadOnly={false}
        mostDemandedLabel="foo"
        sentAt={new Date().toISOString()}
        defaultValue={55}
        onSubmit={mockOnSubmit}
      />
    );

    // WHEN clicking submitting without editing
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON));

    // THEN typing indicator appears
    expect(screen.getByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).toBeInTheDocument();

    // WHEN typing finishes
    act(() => jest.runAllTimers());

    // THEN submit with default value
    expect(mockOnSubmit).toHaveBeenCalledWith(55);
  });

  test("should not submit when read only", async () => {
    // GIVEN read-only component
    const mockOnSubmit = jest.fn();
    render(
      <SkillsRankingPerceivedRank
        isReadOnly={true}
        mostDemandedLabel="foo"
        sentAt={new Date().toISOString()}
        defaultValue={40}
        onSubmit={mockOnSubmit}
      />
    );

    // WHEN changing the slider and clicking Submit
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SLIDER), { target: { value: 70 } });
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_PERCEIVED_RANK_SUBMIT_BUTTON));

    // THEN typing indicator isn't shown
    expect(screen.queryByTestId(TYPING_DATA_TEST_ID.TYPING_CHAT_MESSAGE_CONTAINER)).not.toBeInTheDocument();
    // AND onSubmit not called
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
