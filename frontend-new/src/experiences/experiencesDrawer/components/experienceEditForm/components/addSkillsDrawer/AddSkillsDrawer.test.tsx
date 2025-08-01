// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import AddSkillsDrawer, { DATA_TEST_ID } from "./AddSkillsDrawer";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import userEvent from "@testing-library/user-event";
import { DATA_TEST_ID as SKILL_POPOVER_TEST_ID } from "src/experiences/experiencesDrawer/components/skillPopover/SkillPopover";

describe("AddSkillsDrawer", () => {
  test("should render component successfully", () => {
    // GIVEN a component with skills
    const skills = mockExperiences[0].top_skills;
    const givenComponent = <AddSkillsDrawer skills={skills} onAddSkill={jest.fn()} onClose={jest.fn()} />;

    // WHEN the component is rendered
    render(givenComponent);

    // THEN expect the drawer to be in the document
    const drawer = screen.getByTestId(DATA_TEST_ID.SKILLS_DRAWER);
    expect(drawer).toBeInTheDocument();
    // AND the title to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.SKILL_DRAWER_TITLE)).toBeInTheDocument();
    // AND the subtitle to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.SKILL_DRAWER_SUBTITLE)).toBeInTheDocument();
    // AND the skills to be unchecked by default
    screen.getAllByTestId(DATA_TEST_ID.SKILL_DRAWER_ITEM_UNCHECKED).forEach((item) => {
      expect(item).toBeInTheDocument();
    });
    // AND the skills to be in the document
    screen.getAllByTestId(DATA_TEST_ID.SKILL_DRAWER_ITEM).forEach((item) => {
      expect(item).toBeInTheDocument();
    });
    // AND the cancel button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.SKILL_DRAWER_CANCEL_BUTTON)).toBeInTheDocument();
    // AND the OK button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.SKILL_DRAWER_OK_BUTTON)).toBeInTheDocument();
    // AND to match the snapshot
    expect(drawer).toMatchSnapshot();
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should call onAddSkill when OK button is clicked with selected skills", async () => {
    // GIVEN a component with skills
    const skills = mockExperiences[0].top_skills;
    const onAddSkill = jest.fn();
    const givenComponent = <AddSkillsDrawer skills={skills} onAddSkill={onAddSkill} onClose={jest.fn()} />;

    // WHEN the component is rendered
    render(givenComponent);
    // AND the first skill is checked
    const firstSkillCheckbox = screen.getAllByTestId(DATA_TEST_ID.SKILL_DRAWER_ITEM_UNCHECKED)[0];
    await userEvent.click(firstSkillCheckbox);

    // THEN expect the first skill to be checked
    expect(screen.getAllByTestId(DATA_TEST_ID.SKILL_DRAWER_ITEM_CHECKED)[0]).toBeInTheDocument();

    // WHEN the OK button is clicked
    const okButton = screen.getByTestId(DATA_TEST_ID.SKILL_DRAWER_OK_BUTTON);
    await userEvent.click(okButton);

    // THEN expect onAddSkill to have been called with the selected skill ID
    expect(onAddSkill).toHaveBeenCalledWith([skills[0].UUID]);
  });

  test("should call onClose when Cancel button is clicked", async () => {
    // GIVEN a component with skills
    const skills = mockExperiences[0].top_skills;
    const onClose = jest.fn();
    const givenComponent = <AddSkillsDrawer skills={skills} onAddSkill={jest.fn()} onClose={onClose} />;

    // WHEN the component is rendered
    render(givenComponent);
    // AND the Cancel button is clicked
    const cancelButton = screen.getByTestId(DATA_TEST_ID.SKILL_DRAWER_CANCEL_BUTTON);
    await userEvent.click(cancelButton);

    // THEN expect onClose to have been called
    expect(onClose).toHaveBeenCalled();
  });

  test("should check and uncheck skills when clicked", async () => {
    // GIVEN a component with skills
    const skills = mockExperiences[0].top_skills;
    const givenComponent = <AddSkillsDrawer skills={skills} onAddSkill={jest.fn()} onClose={jest.fn()} />;
    // AND the component is rendered
    render(givenComponent);

    // WHEN the first unchecked skill is clicked
    const uncheckedSkill = screen.getAllByTestId(DATA_TEST_ID.SKILL_DRAWER_ITEM_UNCHECKED)[0];
    await userEvent.click(uncheckedSkill);

    // THEN expect the first skill to be checked
    const checkedSkill = screen.getAllByTestId(DATA_TEST_ID.SKILL_DRAWER_ITEM_CHECKED)[0];
    expect(checkedSkill).toBeInTheDocument();
    // AND clicking the checked skill should uncheck it
    await userEvent.click(checkedSkill);

    // THEN expect it to be unchecked again
    expect(screen.getAllByTestId(DATA_TEST_ID.SKILL_DRAWER_ITEM_UNCHECKED)[0]).toBeInTheDocument();
    // AND the checked skill should no longer exist
    expect(screen.queryAllByTestId(DATA_TEST_ID.SKILL_DRAWER_ITEM_CHECKED)).toHaveLength(0);
  });

  test("should show skill popover when skill label is clicked", async () => {
    // GIVEN a component with skills
    const skills = mockExperiences[0].top_skills;
    const givenComponent = <AddSkillsDrawer skills={skills} onAddSkill={jest.fn()} onClose={jest.fn()} />;

    // WHEN the component is rendered
    render(givenComponent);
    // AND the first skill label is clicked
    const skillLabel = screen.getAllByTestId(DATA_TEST_ID.SKILL_DRAWER_ITEM)[0];
    await userEvent.click(skillLabel);

    // THEN expect the popover to be in the document
    const popover = screen.getByTestId(SKILL_POPOVER_TEST_ID.SKILL_POPOVER);
    expect(popover).toBeInTheDocument();

    // WHEN the popover is closed
    await userEvent.keyboard("{Escape}");

    // THEN expect the popover to be removed from the document
    expect(screen.queryByTestId(SKILL_POPOVER_TEST_ID.SKILL_POPOVER)).not.toBeInTheDocument();
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
