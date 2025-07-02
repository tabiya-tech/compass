// mute the console
import "src/_test_utilities/consoleMock";

import ExperienceEditForm, { DATA_TEST_ID } from "./ExperienceEditForm";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "src/_test_utilities/test-utils";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { WorkType } from "src/experiences/experienceService/experiences.types";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import ExperienceService from "src/experiences/experienceService/experienceService";

// mock the user preferences state service
jest.mock("src/userPreferences/UserPreferencesStateService", () => ({
  getInstance: jest.fn().mockReturnValue({
    getUserPreferences: jest.fn().mockReturnValue({
      sessions: [1234],
    }),
  }),
}));

// mock the snackbar
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

// mock the ContextMenu
jest.mock("src/theme/ContextMenu/ContextMenu", () => {
  const actual = jest.requireActual("src/theme/ContextMenu/ContextMenu");
  return {
    __esModule: true,
    default: jest.fn(({ items }: { items: MenuItemConfig[] }) => (
      <div data-testid={actual.DATA_TEST_ID.MENU}>
        {items.map((item) => (
          <div key={item.id} data-testid={item.id} onClick={item.action}>
            {item.text}
          </div>
        ))}
        ;
      </div>
    )),
    DATA_TEST_ID: actual.DATA_TEST_ID,
  };
});

describe("ExperienceEditForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should render ExperienceEditForm correctly", () => {
    // GIVEN the ExperienceEditForm component
    const givenExperienceEditForm = (
      <ExperienceEditForm
        experience={{ ...mockExperiences[0] }}
        notifyOnSave={jest.fn()}
        notifyOnCancel={jest.fn()}
        notifyOnUnsavedChange={jest.fn()}
      />
    );

    // WHEN the component is rendered
    render(givenExperienceEditForm);

    // THEN experience edit form container to be in the document
    const experienceEditFormContainer = screen.getByTestId(DATA_TEST_ID.FORM_CONTAINER);
    expect(experienceEditFormContainer).toBeInTheDocument();
    // AND the save button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FORM_SAVE_BUTTON)).toBeInTheDocument();
    // AND the cancel button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FORM_CANCEL_BUTTON)).toBeInTheDocument();
    // AND the experience work type to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FORM_WORK_TYPE)).toBeInTheDocument();
    // AND the experience title textfield to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FORM_EXPERIENCE_TITLE)).toBeInTheDocument();
    // AND the start date to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FORM_START_DATE)).toBeInTheDocument();
    // AND the end date to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FORM_END_DATE)).toBeInTheDocument();
    // AND the company textfield to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FORM_COMPANY)).toBeInTheDocument();
    // AND the location textfield to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FORM_LOCATION)).toBeInTheDocument();
    // AND the summary textfield to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FORM_SUMMARY)).toBeInTheDocument();
    // AND the top skills textfield to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FORM_SKILLS_CONTAINER)).toBeInTheDocument();
    // AND the top skills chips to be in the document
    const chips = screen.getAllByTestId(DATA_TEST_ID.FORM_SKILL_CHIP);
    chips.forEach((chip) => expect(chip).toBeInTheDocument());
    // AND the dropdown to be in the document
    const chipsDropdown = screen.getAllByTestId(DATA_TEST_ID.FORM_SKILL_CHIP_DROPDOWN);
    chipsDropdown.forEach((dropdown) => expect(dropdown).toBeInTheDocument());
    // AND the delete button to be in the document
    const chipsDeleteIcons = screen.getAllByTestId(DATA_TEST_ID.FORM_SKILL_CHIP_DELETE_ICON);
    chipsDeleteIcons.forEach((icon) => expect(icon).toBeInTheDocument());
    // AND to match the snapshot
    expect(experienceEditFormContainer).toMatchSnapshot();
    // AND no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should call notifyOnCancel when cancel button is clicked", async () => {
    // GIVEN the ExperienceEditForm component with a mock notifyOnCancel function
    const notifyOnCancel = jest.fn();
    const givenExperienceEditForm = (
      <ExperienceEditForm
        experience={{ ...mockExperiences[0] }}
        notifyOnSave={jest.fn()}
        notifyOnCancel={notifyOnCancel}
        notifyOnUnsavedChange={jest.fn()}
      />
    );

    // WHEN the component is rendered
    render(givenExperienceEditForm);

    // AND the cancel button is clicked
    const cancelButton = screen.getByTestId(DATA_TEST_ID.FORM_CANCEL_BUTTON);
    await userEvent.click(cancelButton);

    // THEN notifyOnCancel should have been called
    expect(notifyOnCancel).toHaveBeenCalled();
    // AND no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should display work type menu and update when new type is selected", async () => {
    // GIVEN the ExperienceEditForm component
    const notifyOnUnsavedChange = jest.fn();
    const notifyOnSave = jest.fn();
    // AND the ExperienceService is mocked to return the first mock experience
    const mockUpdateExperience = {
      ...mockExperiences[0],
      work_type: WorkType.SELF_EMPLOYMENT,
    }
    jest.spyOn(ExperienceService.getInstance(), "updateExperience").mockResolvedValueOnce(mockUpdateExperience);
    const givenExperienceEditForm = (
      <ExperienceEditForm
        experience={{ ...mockExperiences[0] }}
        notifyOnSave={notifyOnSave}
        notifyOnCancel={jest.fn()}
        notifyOnUnsavedChange={notifyOnUnsavedChange}
      />
    );
    // AND the component is rendered
    render(givenExperienceEditForm);

    // WHEN the work type dropdown icon is clicked
    const workTypeDropdownIcon = screen.getByTestId(DATA_TEST_ID.FORM_WORK_TYPE_DROPDOWN);
    await userEvent.click(workTypeDropdownIcon);

    // THEN the work type menu should be opened with menu items
    expect(ContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        items: expect.arrayContaining([expect.objectContaining({ id: WorkType.SELF_EMPLOYMENT })]),
      }),
      expect.anything()
    );

    // WHEN a menu item is clicked (Self Employment)
    const selfEmploymentItem = screen.getByTestId(WorkType.SELF_EMPLOYMENT);
    await userEvent.click(selfEmploymentItem);

    // THEN the work type text should be updated
    const workTypeElement = screen.getByTestId(DATA_TEST_ID.FORM_WORK_TYPE);
    expect(workTypeElement).toHaveTextContent(/self-employment/i);
    // AND notifyOnUnsavedChange should have been called
    expect(notifyOnUnsavedChange).toHaveBeenCalledWith(true);

    // WHEN the save button is clicked
    const saveButton = screen.getByTestId(DATA_TEST_ID.FORM_SAVE_BUTTON);
    await userEvent.click(saveButton);

    // THEN the notifyOnSave should have been called with updated experience
    expect(notifyOnSave).toHaveBeenCalled();
    const savedExperience = notifyOnSave.mock.calls[0][0];
    expect(savedExperience.work_type).toBe(WorkType.SELF_EMPLOYMENT);
    // AND no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should change skill label when selecting alternative label from dropdown", async () => {
    // GIVEN an experience with skills that have alternative labels
    const experienceWithSkills = {
      ...mockExperiences[0],
      top_skills: [
        {
          UUID: "skill-1",
          preferredLabel: "javascript",
          description: "A programming language",
          altLabels: ["js", "ecmascript"],
        },
      ],
    };
    // AND the component is rendered
    const notifyOnSave = jest.fn();
    jest.spyOn(ExperienceService.getInstance(), "updateExperience").mockResolvedValueOnce(experienceWithSkills);

    const givenExperienceEditForm = (
      <ExperienceEditForm
        experience={experienceWithSkills}
        notifyOnSave={notifyOnSave}
        notifyOnCancel={jest.fn()}
        notifyOnUnsavedChange={jest.fn()}
      />
    );
    render(givenExperienceEditForm);

    // WHEN the skill dropdown is clicked
    const skillDropdown = screen.getByTestId(DATA_TEST_ID.FORM_SKILL_CHIP_DROPDOWN);
    await userEvent.click(skillDropdown);

    // THEN the context menu should be called with alt labels
    expect(ContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        items: expect.arrayContaining([expect.objectContaining({ id: "ecmascript" })]),
      }),
      expect.anything()
    );

    // WHEN an alternative label is selected
    const altLabelItem = screen.getByTestId("ecmascript");
    await userEvent.click(altLabelItem);
    // AND the save button is clicked
    const saveButton = screen.getByTestId(DATA_TEST_ID.FORM_SAVE_BUTTON);
    await userEvent.click(saveButton);

    // THEN notifyOnSave should be called with the updated skill label
    expect(notifyOnSave).toHaveBeenCalled();;
    // AND no errors or warnings occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should mark skill for deletion when delete icon is clicked", async () => {
    // GIVEN an experience with multiple skills
    const experienceWithSkills = {
      ...mockExperiences[0],
      top_skills: [
        {
          UUID: "skill-1",
          preferredLabel: "javascript",
          description: "A programming language",
          altLabels: ["js", "ecmascript"],
        },
        {
          UUID: "skill-2",
          preferredLabel: "react",
          description: "A library for building user interfaces",
          altLabels: ["reactjs", "reactjs.org"],
        },
      ],
    };

    // WHEN the component is rendered
    const notifyOnSave = jest.fn();
    jest.spyOn(ExperienceService.getInstance(), "updateExperience").mockResolvedValueOnce(experienceWithSkills);
    const notifyOnUnsavedChange = jest.fn();
    const givenExperienceEditForm = (
      <ExperienceEditForm
        experience={experienceWithSkills}
        notifyOnSave={notifyOnSave}
        notifyOnCancel={jest.fn()}
        notifyOnUnsavedChange={notifyOnUnsavedChange}
      />
    );
    render(givenExperienceEditForm);

    // THEN there should be two skills shown
    const skillChips = screen.getAllByTestId(DATA_TEST_ID.FORM_SKILL_CHIP);
    expect(skillChips).toHaveLength(2);

    // WHEN the delete icon is clicked for the first skill
    const deleteIcons = screen.getAllByTestId(DATA_TEST_ID.FORM_SKILL_CHIP_DELETE_ICON);
    expect(deleteIcons).toHaveLength(2);
    await userEvent.click(deleteIcons[0]);

    // THEN the undo icon should be visible for the deleted skill
    const undoIcons = screen.getAllByTestId(DATA_TEST_ID.FORM_SKILL_CHIP_UNDO_ICON);
    expect(undoIcons).toHaveLength(1);

    // WHEN the save button is clicked
    const saveButton = screen.getByTestId(DATA_TEST_ID.FORM_SAVE_BUTTON);
    await userEvent.click(saveButton);

    // THEN notifyOnSave should be called with only the non-deleted skill
    expect(notifyOnSave).toHaveBeenCalled()
    // AND no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should undo skill deletion when undo icon is clicked", async () => {
    // GIVEN an experience with multiple skills
    const experienceWithSkills = {
      ...mockExperiences[0],
      top_skills: [
        {
          UUID: "skill-1",
          preferredLabel: "javascript",
          description: "A programming language",
          altLabels: ["js", "ecmascript"],
        },
        {
          UUID: "skill-2",
          preferredLabel: "react",
          description: "A library for building user interfaces",
          altLabels: ["reactjs", "reactjs.org"],
        },
      ],
    };

    // AND the component is rendered
    const notifyOnSave = jest.fn();
    const notifyOnUnsavedChange = jest.fn();
    const givenExperienceEditForm = (
      <ExperienceEditForm
        experience={experienceWithSkills}
        notifyOnSave={notifyOnSave}
        notifyOnCancel={jest.fn()}
        notifyOnUnsavedChange={notifyOnUnsavedChange}
      />
    );
    render(givenExperienceEditForm);

    // WHEN the delete icon is clicked for the first skill
    const deleteIcons = screen.getAllByTestId(DATA_TEST_ID.FORM_SKILL_CHIP_DELETE_ICON);
    await userEvent.click(deleteIcons[0]);

    // THEN the undo icon should be visible
    const undoIcons = screen.getAllByTestId(DATA_TEST_ID.FORM_SKILL_CHIP_UNDO_ICON);
    expect(undoIcons).toHaveLength(1);

    // WHEN the undo icon is clicked
    await userEvent.click(undoIcons[0]);

    // THEN the delete icons should be visible again for both skills
    const deleteIconsAfterUndo = screen.getAllByTestId(DATA_TEST_ID.FORM_SKILL_CHIP_DELETE_ICON);
    expect(deleteIconsAfterUndo).toHaveLength(2);
    // AND no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should update experience when text fields are changed", async () => {
    // GIVEN the ExperienceEditForm component
    const notifyOnSave = jest.fn();
    // AND the ExperienceService is mocked to return the first mock experience
    const mockUpdateExperience = {
      ...mockExperiences[0],
      experience_title: "foo title",
      company: "bar company",
      location: "baz location",
    }
    jest.spyOn(ExperienceService.getInstance(), "updateExperience").mockResolvedValueOnce(mockUpdateExperience);
    const notifyOnUnsavedChange = jest.fn();
    const givenExperienceEditForm = (
      <ExperienceEditForm
        experience={{ ...mockExperiences[0] }}
        notifyOnSave={notifyOnSave}
        notifyOnCancel={jest.fn()}
        notifyOnUnsavedChange={notifyOnUnsavedChange}
      />
    );
    // AND the component is rendered
    render(givenExperienceEditForm);

    // WHEN multiple text fields are updated
    const titleField = screen.getByTestId(DATA_TEST_ID.FORM_EXPERIENCE_TITLE);
    const companyField = screen.getByTestId(DATA_TEST_ID.FORM_COMPANY);
    const locationField = screen.getByTestId(DATA_TEST_ID.FORM_LOCATION);

    const titleInput = within(titleField).getByRole("textbox");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "foo title");
    const companyInput = within(companyField).getByRole("textbox");
    await userEvent.clear(companyInput);
    await userEvent.type(companyInput, "bar company");
    const locationInput = within(locationField).getByRole("textbox");
    await userEvent.clear(locationInput);
    await userEvent.type(locationInput, "baz location");

    // THEN notifyOnUnsavedChange should have been called
    expect(notifyOnUnsavedChange).toHaveBeenCalledWith(true);

    // WHEN the form is saved
    await userEvent.click(screen.getByTestId(DATA_TEST_ID.FORM_SAVE_BUTTON));

    // THEN all field changes should be included in the save data
    expect(notifyOnSave).toHaveBeenCalled();
    const savedExperience = notifyOnSave.mock.calls[0][0];
    expect(savedExperience.experience_title).toBe("foo title");
    expect(savedExperience.company).toBe("bar company");
    expect(savedExperience.location).toBe("baz location");
    // AND no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should disable save button when there are no changes", async () => {
    // GIVEN the ExperienceEditForm component
    const notifyOnSave = jest.fn();
    const givenExperienceEditForm = (
      <ExperienceEditForm
        experience={{ ...mockExperiences[0] }}
        notifyOnSave={notifyOnSave}
        notifyOnCancel={jest.fn()}
        notifyOnUnsavedChange={jest.fn()}
      />
    );

    // WHEN the component is rendered
    render(givenExperienceEditForm);

    // THEN the save button should be disabled initially
    const saveButton = screen.getByTestId(DATA_TEST_ID.FORM_SAVE_BUTTON);
    expect(saveButton).toBeDisabled();

    // WHEN a field is changed
    const titleField = screen.getByTestId(DATA_TEST_ID.FORM_EXPERIENCE_TITLE);
    const titleInput = within(titleField).getByRole("textbox");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "foo bar");

    // THEN the save button should be enabled
    expect(saveButton).not.toBeDisabled();
    // AND no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should successfully update experience and notify parent when save button is clicked", async () => {
    // GIVEN the ExperienceEditForm component
    const notifyOnSave = jest.fn();
    const mockUpdateExperience = jest.spyOn(ExperienceService.getInstance(), "updateExperience").mockResolvedValueOnce(mockExperiences[0]);
    const givenExperienceEditForm = (
      <ExperienceEditForm
        experience={{ ...mockExperiences[0] }}
        notifyOnSave={notifyOnSave}
        notifyOnCancel={jest.fn()}
        notifyOnUnsavedChange={jest.fn()}
      />
    );
    // AND the component is rendered
    render(givenExperienceEditForm);

    // WHEN multiple fields are updated
    const titleField = screen.getByTestId(DATA_TEST_ID.FORM_EXPERIENCE_TITLE);
    const companyField = screen.getByTestId(DATA_TEST_ID.FORM_COMPANY);

    const titleInput = within(titleField).getByRole("textbox");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "foo title");

    const companyInput = within(companyField).getByRole("textbox");
    await userEvent.clear(companyInput);
    await userEvent.type(companyInput, "foo Company");

    // AND the save button is clicked
    const saveButton = screen.getByTestId(DATA_TEST_ID.FORM_SAVE_BUTTON);
    await userEvent.click(saveButton);

    // THEN updateExperience should be called with the correct parameters
    expect(mockUpdateExperience).toHaveBeenCalledWith(
      1234,
      mockExperiences[0].UUID,
      expect.objectContaining({
        experience_title: "foo title",
        company: "foo Company",
      })
    );
    // AND notifyOnSave should be called with the updated experience
    expect(notifyOnSave).toHaveBeenCalledWith(mockExperiences[0]);
    // AND the snackbar should show a success message
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Experience updated successfully!", {
      variant: "success",
    });
    // AND no errors or warnings should have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("Should show an error message when updating the experience fails", async () => {
    // GIVEN a service that will fail when updating the experience
    const givenError = new Error("API failed to update experience");
    const mockUpdateExperience = jest.spyOn(ExperienceService.getInstance(), "updateExperience").mockRejectedValueOnce(givenError);
    // AND the ExperienceEditForm component
    const notifyOnSave = jest.fn();
    const notifyOnUnsavedChange = jest.fn();
    const givenExperienceEditForm = (
      <ExperienceEditForm
        experience={{ ...mockExperiences[0] }}
        notifyOnSave={notifyOnSave}
        notifyOnCancel={jest.fn()}
        notifyOnUnsavedChange={notifyOnUnsavedChange}
      />
    );
    // AND the component is rendered
    render(givenExperienceEditForm);

    // WHEN a field is updated
    const titleField = screen.getByTestId(DATA_TEST_ID.FORM_EXPERIENCE_TITLE);
    const titleInput = within(titleField).getByRole("textbox");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "foo bar");

    // AND the save button is clicked
    const saveButton = screen.getByTestId(DATA_TEST_ID.FORM_SAVE_BUTTON);
    await userEvent.click(saveButton);

    // THEN updateExperience should be called with the correct parameters
    expect(mockUpdateExperience).toHaveBeenCalledWith(
      1234,
      mockExperiences[0].UUID,
      expect.objectContaining({
        experience_title: "foo bar",
      })
    );
    // AND notifyOnSave should NOT be called
    expect(notifyOnSave).not.toHaveBeenCalled();
    // AND an error snackbar should be shown
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to update experience. Please try again later.", {
      variant: "error",
    });
    // AND the error should be logged to console
    expect(console.error).toHaveBeenCalledWith("Failed to update experience:", givenError);
  });
});
