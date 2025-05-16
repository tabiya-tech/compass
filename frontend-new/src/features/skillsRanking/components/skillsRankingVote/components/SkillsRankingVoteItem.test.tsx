// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import SkillsRankingVoteItem, {
  DATA_TEST_ID,
} from "src/features/skillsRanking/components/skillsRankingVote/components/SkillsRankingVoteItem";
import userEvent from "@testing-library/user-event";

describe("SkillsRankingVoteItem tests", () => {
  describe("render tests", () => {
    test("should render component successfully", () => {
      // GIVEN SkillsRankingVoteItem component
      const givenSkillsRankingVoteItem = (
        <SkillsRankingVoteItem
          option={{ value: "foo", percent: 10 }}
          index={0}
          selectedIndex={null}
          hoveredIndex={null}
          disabled={false}
          onSelect={jest.fn()}
          onHover={jest.fn()}
          isLast={false}
          showTopLabel={true}
          showBottomLabel={true}
        />
      );

      // WHEN the component is rendered
      render(givenSkillsRankingVoteItem);

      // THEN expect the container to be in the document
      const container = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM);
      expect(container).toBeInTheDocument();
      // AND expect the radio button to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM_RADIO)).toBeInTheDocument();
      // AND expect the divider to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM_DIVIDER)).toBeInTheDocument();
      // AND expect the top label to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM_TOP_LABEL)).toBeInTheDocument();
      // AND expect the bottom label to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM_BOTTOM_LABEL)).toBeInTheDocument();
      // AND to match the snapshot
      expect(container).toMatchSnapshot();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("action tests", () => {
    test("should call onSelect with correct index when radio button is clicked", async () => {
      // GIVEN SkillsRankingVoteItem component
      const mockOnSelect = jest.fn();
      const givenIndex = 0;
      const givenSkillsRankingVoteItem = (
        <SkillsRankingVoteItem
          option={{ value: "foo", percent: 10 }}
          index={givenIndex}
          selectedIndex={null}
          hoveredIndex={null}
          disabled={false}
          onSelect={mockOnSelect}
          onHover={jest.fn()}
          isLast={false}
          showTopLabel={true}
          showBottomLabel={true}
        />
      );
      // AND the component is rendered
      render(givenSkillsRankingVoteItem);

      // WHEN the radio button is clicked
      const radioButton = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM_RADIO);
      await userEvent.click(radioButton);

      // THEN expect onSelect to have been called
      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      // AND to have been called with the correct index
      expect(mockOnSelect).toHaveBeenCalledWith(givenIndex);
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should call onHover with correct index when mouse enters and leaves the component", async () => {
      // GIVEN SkillsRankingVoteItem component
      const mockOnHover = jest.fn();
      const givenIndex = 0;
      const givenSkillsRankingVoteItem = (
        <SkillsRankingVoteItem
          option={{ value: "foo", percent: 10 }}
          index={givenIndex}
          selectedIndex={null}
          hoveredIndex={null}
          disabled={false}
          onSelect={jest.fn()}
          onHover={mockOnHover}
          isLast={false}
          showTopLabel={true}
          showBottomLabel={true}
        />
      );
      // AND the component is rendered
      render(givenSkillsRankingVoteItem);

      // WHEN the mouse enters the component
      const container = screen.getByTestId(DATA_TEST_ID.SKILLS_RANKING_VOTE_ITEM_RADIO);
      await userEvent.hover(container);

      // THEN expect onHover to have been called
      expect(mockOnHover).toHaveBeenCalledTimes(1);
      // AND to have been called with the correct index
      expect(mockOnHover).toHaveBeenCalledWith(givenIndex);

      // WHEN the mouse leaves the component
      await userEvent.unhover(container);

      // THEN expect onHover to have been called with null
      expect(mockOnHover).toHaveBeenCalledTimes(2);
      expect(mockOnHover).toHaveBeenLastCalledWith(null);
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
