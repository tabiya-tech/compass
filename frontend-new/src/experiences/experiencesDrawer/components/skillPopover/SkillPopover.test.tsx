// mute the console
import "src/_test_utilities/consoleMock";

import SkillPopover, { DATA_TEST_ID, SkillPopoverProps } from "./SkillPopover";
import { render, screen } from "src/_test_utilities/test-utils";

describe("SkillPopover", () => {
  describe("render tests", () => {
    const stdGivenProps: SkillPopoverProps = {
      open: true,
      anchorEl: document.createElement("div"),
      onClose: jest.fn(),
      skill: {
        UUID: "skill-uuid",
        preferredLabel: "Skill Name",
        description: "Skill Description",
        altLabels: ["foo", "bar", "baz"],
        orderIndex: 1,
      },
    };

    test("should render the SkillPopover with the given props", () => {
      // GIVEN component
      const giveComponent = <SkillPopover {...stdGivenProps} />;

      // WHEN the component is rendered
      render(giveComponent);

      // THEN expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      // AND the popover to be visible
      const popover = screen.getByTestId(DATA_TEST_ID.SKILL_POPOVER);
      expect(popover).toBeInTheDocument();
      // AND the label to be visible
      const label = screen.getByTestId(DATA_TEST_ID.SKILL_POPOVER_LABEL);
      expect(label).toBeInTheDocument();
      // AND the description to be visible
      const description = screen.getByTestId(DATA_TEST_ID.SKILL_POPOVER_DESCRIPTION);
      expect(description).toBeInTheDocument();
      // AND the alternative labels title to be visible
      const altLabelsTitle = screen.getByTestId(DATA_TEST_ID.SKILL_POPOVER_ALT_LABELS_TITLE);
      expect(altLabelsTitle).toBeInTheDocument();
      // AND the alternative labels to be visible
      const altLabels = screen.getByTestId(DATA_TEST_ID.SKILL_POPOVER_ALT_LABELS);
      expect(altLabels).toBeInTheDocument();
      // AND to match the snapshot
      expect(popover).toMatchSnapshot();
    });
  });
});
