// mute the console
import "src/_test_utilities/consoleMock";

import ExperiencesDrawer, { DATA_TEST_ID } from "src/experiences/experiencesDrawer/ExperiencesDrawer";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, within } from "src/_test_utilities/test-utils";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import { DATA_TEST_ID as EXPERIENCES_DRAWER_HEADER_TEST_ID } from "src/experiences/experiencesDrawer/components/experiencesDrawerHeader/ExperiencesDrawerHeader";
import {
  DATA_TEST_ID as EXPERIENCES_DRAWER_CONTENT_TEST_ID,
  MENU_ITEM_ID,
} from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import { DATA_TEST_ID as CONFIRM_MODAL_DIALOG_DATA_TEST_ID } from "src/theme/confirmModalDialog/ConfirmModalDialog";
import { DATA_TEST_ID as EXPERIENCE_EDIT_FORM_DATA_TEST_ID } from "src/experiences/experiencesDrawer/components/experienceEditForm/ExperienceEditForm";
import { DATA_TEST_ID as RESTORE_EXPERIENCES_DRAWER_DATA_TEST_ID } from "src/experiences/experiencesDrawer/components/restoreExperiencesDrawer/RestoreExperiencesDrawer";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import { DiveInPhase } from "src/experiences/experienceService/experiences.types";
import ExperienceService from "src/experiences/experienceService/experienceService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { ExperienceError } from "src/error/commonErrors";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import { waitFor } from "@testing-library/react";

// mock custom text field
jest.mock("src/theme/CustomTextField/CustomTextField", () => {
  return jest.fn(({ label, ...props }) => {
    return <input aria-label={label} {...props} data-testid={"mock-CustomTextField"} />;
  });
});

// mock DownloadReportDropdown
jest.mock("src/experiences/experiencesDrawer/components/downloadReportDropdown/DownloadReportDropdown", () => {
  return jest.fn(() => {
    return <div data-testid={"mock-DownloadReportDropdown"} />;
  });
});

// mock the Confirm Modal Dialog
jest.mock("src/theme/confirmModalDialog/ConfirmModalDialog", () => {
  const actual = jest.requireActual("src/theme/confirmModalDialog/ConfirmModalDialog");
  const mockConfirmModalDialog = jest
    .fn()
    .mockImplementation(({ onConfirm, onCancel, onDismiss, _isOpen, "data-testid": customTestId }) => (
      <div data-testid={customTestId || actual.DATA_TEST_ID.CONFIRM_MODAL}>
        <button data-testid={actual.DATA_TEST_ID.CONFIRM_MODAL_CANCEL} onClick={onCancel} />
        <button data-testid={actual.DATA_TEST_ID.CONFIRM_MODAL_CONFIRM} onClick={onConfirm} />
        <button data-testid={actual.DATA_TEST_ID.CONFIRM_MODAL_CLOSE} onClick={onDismiss} />
      </div>
    ));
  return {
    __esModule: true,
    default: mockConfirmModalDialog,
    DATA_TEST_ID: actual.DATA_TEST_ID,
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

// mock the snack bar provider
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

// mock the InlineEditField
jest.mock("src/theme/InlineEditField/InlineEditField", () => ({
  __esModule: true,
  default: jest.fn(({ value, onChange, "data-testid": testId }) => (
    <div data-testid={testId}>
      <input type="text" value={value ?? ""} onChange={(e) => onChange({ target: { value: e.target.value } })} />
    </div>
  )),
}));

describe("ExperiencesDrawer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAllMethodMocks(UserPreferencesStateService.getInstance());
  });

  test("should render ExperiencesDrawer correctly", () => {
    // GIVEN the ExperiencesDrawer component
    const givenExperiencesDrawer = (
      <ExperiencesDrawer
        isOpen={true}
        isLoading={false}
        experiences={mockExperiences}
        notifyOnClose={jest.fn()}
        conversationConductedAt="2021-06-01T00:00:00Z"
        onExperiencesUpdated={jest.fn()}
      />
    );

    // WHEN the component is rendered
    render(givenExperiencesDrawer);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the experiences drawer container to be in the document
    const experiencesDrawerContainer = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTAINER);
    expect(experiencesDrawerContainer).toBeInTheDocument();
    // AND the experiences drawer header to be in the document
    const experiencesDrawerHeaderContainer = screen.getByTestId(
      EXPERIENCES_DRAWER_HEADER_TEST_ID.EXPERIENCES_DRAWER_HEADER_CONTAINER
    );
    expect(experiencesDrawerHeaderContainer).toBeInTheDocument();
    // AND the divider to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DIVIDER)).toBeInTheDocument();
    // AND the experiences drawer content to be in the document
    const experiencesDrawerContentContainer = screen.getAllByTestId(
      EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_CONTENT_CONTAINER
    );
    expect(experiencesDrawerContentContainer).toHaveLength(mockExperiences.length);
    // AND to match the snapshot
    expect(experiencesDrawerContainer).toMatchSnapshot();
  });

  test("should call notifyOnClose when close button is clicked", () => {
    // GIVEN the ExperiencesDrawer component
    const notifyOnClose = jest.fn();
    const givenExperiencesDrawer = (
      <ExperiencesDrawer
        isOpen={true}
        isLoading={false}
        experiences={mockExperiences}
        notifyOnClose={notifyOnClose}
        conversationConductedAt="2021-06-01T00:00:00Z"
        onExperiencesUpdated={jest.fn()}
      />
    );
    // AND the component is rendered
    render(givenExperiencesDrawer);

    // WHEN the close button is clicked
    const closeButton = screen.getByTestId(EXPERIENCES_DRAWER_HEADER_TEST_ID.EXPERIENCES_DRAWER_HEADER_BUTTON);
    fireEvent.click(closeButton);

    // THEN expect notifyOnClose to have been called
    expect(notifyOnClose).toHaveBeenCalledWith({ name: "DISMISS" });
  });

  test("it should show the right text when there are no experiences", () => {
    // GIVEN the ExperiencesDrawer component
    const givenExperiencesDrawer = (
      <ExperiencesDrawer
        isOpen={true}
        isLoading={false}
        experiences={[]}
        notifyOnClose={jest.fn()}
        conversationConductedAt="2021-06-01T00:00:00Z"
        onExperiencesUpdated={jest.fn()}
      />
    );
    // AND the component is rendered
    render(givenExperiencesDrawer);

    // THEN expect the text to be in the document
    const noExperiencesText = screen.getByText(
      "We haven't yet discovered any experiences so far, Let's continue chatting."
    );
    expect(noExperiencesText).toBeInTheDocument();
  });

  test("it should show loading state when isLoading is true", () => {
    // GIVEN the ExperiencesDrawer component
    const givenExperiencesDrawer = (
      <ExperiencesDrawer
        isOpen={true}
        isLoading={true}
        experiences={[]}
        notifyOnClose={jest.fn()}
        conversationConductedAt="2021-06-01T00:00:00Z"
        onExperiencesUpdated={jest.fn()}
      />
    );
    // AND the component is rendered
    render(givenExperiencesDrawer);

    // THEN expect the loading state to be in the document
    const loadingContainer = screen.getByTestId(DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_LOADER);
    expect(loadingContainer).toBeInTheDocument();
  });

  test("should handle onChange correctly when the text field changes", async () => {
    // GIVEN the ExperiencesDrawer component
    const givenExperiencesDrawer = (
      <ExperiencesDrawer
        isOpen={true}
        isLoading={false}
        experiences={mockExperiences}
        notifyOnClose={jest.fn()}
        conversationConductedAt="2021-06-01T00:00:00Z"
        onExperiencesUpdated={jest.fn()}
      />
    );
    // AND the component is rendered
    render(givenExperiencesDrawer);

    // WHEN the name field is changed
    const nameField = screen.getByLabelText("Name:");
    fireEvent.change(nameField, { target: { value: "John Doe" } });
    // THEN expect the name field to have the correct value
    expect(nameField).toHaveValue("John Doe");

    // WHEN the email field is changed
    const emailField = screen.getByLabelText("Email:");
    fireEvent.change(emailField, { target: { value: "john.doe@example.com" } });
    // THEN expect the email field to have the correct value
    expect(emailField).toHaveValue("john.doe@example.com");

    // WHEN the phone field is changed
    const phoneField = screen.getByLabelText("Phone:");
    // THEN expect the phone field to have the correct value
    fireEvent.change(phoneField, { target: { value: "1234567890" } });
    expect(phoneField).toHaveValue("1234567890");

    // WHEN the address field is changed
    const addressField = screen.getByLabelText("Address:");
    fireEvent.change(addressField, { target: { value: "123 Main St" } });
    // THEN expect the address field to have the correct value
    expect(addressField).toHaveValue("123 Main St");
  });

  describe("ExperienceEditForm", () => {
    test("should render ExperienceEditForm when edit button is clicked", async () => {
      // GIVEN some experiences that have been explored
      const givenExploredExperiences = mockExperiences.map((experience) => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED,
      }));
      // AND the ExperiencesDrawer component
      const givenExperiencesDrawer = (
        <ExperiencesDrawer
          isOpen={true}
          isLoading={false}
          experiences={givenExploredExperiences}
          notifyOnClose={jest.fn()}
          conversationConductedAt="2021-06-01T00:00:00Z"
          onExperiencesUpdated={jest.fn()}
        />
      );
      // AND the component is rendered
      render(givenExperiencesDrawer);

      // WHEN the more button is clicked for a specific experience
      const moreButton = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)[0];
      await userEvent.click(moreButton);
      // WHEN the edit button is clicked
      const editButton = screen.getAllByTestId(MENU_ITEM_ID.EDIT)[0];
      await userEvent.click(editButton);

      // THEN expect the ExperienceEditForm to be in the document
      const experienceEditForm = screen.getByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_CONTAINER);
      expect(experienceEditForm).toBeInTheDocument();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should show confirmation dialog when unsaved changes exist and cancel button is clicked", async () => {
      // GIVEN some experiences that have been explored
      const givenExploredExperiences = mockExperiences.map((experience) => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED,
      }));
      // AND the ExperiencesDrawer component
      const givenExperiencesDrawer = (
        <ExperiencesDrawer
          isOpen={true}
          isLoading={false}
          experiences={givenExploredExperiences}
          notifyOnClose={jest.fn()}
          conversationConductedAt="2021-06-01T00:00:00Z"
          onExperiencesUpdated={jest.fn()}
        />
      );
      // AND the component is rendered
      render(givenExperiencesDrawer);

      // WHEN the more button is clicked for a specific experience
      const moreButton = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)[0];
      await userEvent.click(moreButton);
      // WHEN the edit button is clicked
      const editButton = screen.getAllByTestId(MENU_ITEM_ID.EDIT)[0];
      await userEvent.click(editButton);

      // THEN expect the ExperienceEditForm to be visible
      const experienceEditForm = screen.getByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_CONTAINER);
      expect(experienceEditForm).toBeInTheDocument();

      // WHEN some changes are made in the form
      const locationField = within(screen.getByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_LOCATION)).getByRole(
        "textbox"
      );
      await userEvent.type(locationField, "foo location");
      // AND the cancel button is clicked
      const cancelButton = screen.getByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_CANCEL_BUTTON);
      await userEvent.click(cancelButton);

      // THEN expect a confirmation dialog to be shown
      expect(screen.getByTestId(DATA_TEST_ID.UNSAVED_CHANGES_DIALOG)).toBeInTheDocument();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      { element: "Keep Editing button", testId: CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL_CONFIRM },
      { element: "close icon", testId: CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL_CLOSE },
    ])("should keep ExperienceEditForm open when $element in dialog is clicked", async ({ testId }) => {
      // GIVEN some experiences that have been explored
      const givenExploredExperiences = mockExperiences.map((experience) => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED,
      }));
      // AND the ExperiencesDrawer component
      const givenExperiencesDrawer = (
        <ExperiencesDrawer
          isOpen={true}
          isLoading={false}
          experiences={givenExploredExperiences}
          notifyOnClose={jest.fn()}
          conversationConductedAt="2021-06-01T00:00:00Z"
          onExperiencesUpdated={jest.fn()}
        />
      );
      // AND the component is rendered
      render(givenExperiencesDrawer);

      // WHEN the more button is clicked for a specific experience
      const moreButton = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)[0];
      await userEvent.click(moreButton);
      // WHEN the edit button is clicked
      const editButton = screen.getAllByTestId(MENU_ITEM_ID.EDIT)[0];
      await userEvent.click(editButton);

      // THEN expect the ExperienceEditForm to be visible
      expect(screen.getByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_CONTAINER)).toBeInTheDocument();

      // WHEN some changes are made in the form
      const locationField = screen.getByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_LOCATION);
      const locationInput = within(locationField).getByRole("textbox");
      await userEvent.type(locationInput, "foo location");
      // AND the cancel button is clicked
      const cancelButton = screen.getByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_CANCEL_BUTTON);
      await userEvent.click(cancelButton);

      // THEN expect a confirmation dialog to be shown
      const confirmDialog = await screen.findByTestId(DATA_TEST_ID.UNSAVED_CHANGES_DIALOG);
      expect(confirmDialog).toBeInTheDocument();

      // WHEN the specified element in the confirmation dialog is clicked
      const element = screen.getAllByTestId(testId)[0];
      await userEvent.click(element);

      // THEN expect the ExperienceEditForm to still be visible
      expect(screen.getByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_CONTAINER)).toBeInTheDocument();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should close ExperienceEditForm when close button in the dialog is clicked", async () => {
      // GIVEN some experiences that have been explored
      const givenExploredExperiences = mockExperiences.map((experience) => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED,
      }));
      // AND the ExperiencesDrawer component
      const givenExperiencesDrawer = (
        <ExperiencesDrawer
          isOpen={true}
          isLoading={false}
          experiences={givenExploredExperiences}
          notifyOnClose={jest.fn()}
          conversationConductedAt="2021-06-01T00:00:00Z"
          onExperiencesUpdated={jest.fn()}
        />
      );
      // AND the component is rendered
      render(givenExperiencesDrawer);

      // WHEN the more button is clicked for a specific experience
      const moreButton = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)[0];
      await userEvent.click(moreButton);
      // WHEN the edit button is clicked
      const editButton = screen.getAllByTestId(MENU_ITEM_ID.EDIT)[0];
      await userEvent.click(editButton);
      // AND some changes are made in the form
      const companyField = screen.getByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_COMPANY);
      const companyInput = within(companyField).getByRole("textbox");
      await userEvent.type(companyInput, "foo company");
      // AND the ESC key is pressed to close the form
      await userEvent.keyboard("{Escape}");

      // THEN expect a confirmation dialog to be shown
      const confirmDialog = await screen.findByTestId(DATA_TEST_ID.UNSAVED_CHANGES_DIALOG);
      expect(confirmDialog).toBeInTheDocument();

      // WHEN the cancel button in the confirmation dialog is clicked
      const cancelButton = screen.getAllByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL_CANCEL)[0];
      await userEvent.click(cancelButton);

      // THEN expect the ExperienceEditForm to be closed
      expect(screen.queryByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_CONTAINER)).not.toBeInTheDocument();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should call onExperiencesUpdated when save button is clicked", async () => {
      const updateExperienceMock = jest.spyOn(ExperienceService.prototype, "updateExperience");
      // GIVEN some experiences that have been explored
      const givenExploredExperiences = mockExperiences.map((experience) => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED,
      }));
      // AND a session ID that is set in user preferences
      const givenSessionId = 234;
      UserPreferencesStateService.getInstance().setUserPreferences({
        sessions: [givenSessionId],
      } as unknown as UserPreference);
      // AND the ExperiencesDrawer component
      const onExperiencesUpdated = jest.fn();
      const givenExperiencesDrawer = (
        <ExperiencesDrawer
          isOpen={true}
          isLoading={false}
          experiences={givenExploredExperiences}
          notifyOnClose={jest.fn()}
          conversationConductedAt="2021-06-01T00:00:00Z"
          onExperiencesUpdated={onExperiencesUpdated}
        />
      );
      // AND a mocked service that resolves with the updated experience
      const updatedExperience = {
        ...givenExploredExperiences[0],
        company: "foo company",
      };
      jest.spyOn(ExperienceService.getInstance(), "updateExperience").mockResolvedValueOnce(updatedExperience);

      // AND the component is rendered
      render(givenExperiencesDrawer);

      // WHEN the more button is clicked for a specific experience
      const moreButton = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)[0];
      await userEvent.click(moreButton);
      // WHEN the edit button is clicked
      const editButton = screen.getAllByTestId(MENU_ITEM_ID.EDIT)[0];
      await userEvent.click(editButton);
      // AND some changes are made in the form
      const companyField = screen.getByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_COMPANY);
      const companyInput = within(companyField).getByRole("textbox");
      await userEvent.clear(companyInput);
      await userEvent.type(companyInput, "foo company");
      // AND the save button is clicked
      const saveButton = screen.getByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_SAVE_BUTTON);
      await userEvent.click(saveButton);

      // THEN expect the service to have been called with the correct parameters
      expect(updateExperienceMock).toHaveBeenCalledWith(
        givenSessionId,
        givenExploredExperiences[0].UUID,
        expect.objectContaining({
          company: "foo company",
        })
      );
      // AND expect onExperiencesUpdated to have been called with the updated experience
      expect(onExperiencesUpdated).toHaveBeenCalled();
    });
  });

  describe("Delete Experience", () => {
    test("should delete experience successfully when delete button is clicked", async () => {
      // GIVEN some experiences that have been explored
      const givenExploredExperiences = mockExperiences.map((experience) => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED,
      }));
      // AND a session ID that is set in user preferences
      const givenSessionId = 234;
      UserPreferencesStateService.getInstance().setUserPreferences({
        sessions: [givenSessionId],
      } as unknown as UserPreference);
      const onExperiencesUpdated = jest.fn();
      // AND the component is rendered
      render(
        <ExperiencesDrawer
          isOpen={true}
          isLoading={false}
          experiences={givenExploredExperiences}
          notifyOnClose={jest.fn()}
          conversationConductedAt="2022-06-01T00:00:00Z"
          onExperiencesUpdated={onExperiencesUpdated}
        />
      );
      // AND a mocked service that resolves
      const deleteSpy = jest.spyOn(ExperienceService.getInstance(), "deleteExperience").mockResolvedValueOnce();

      // WHEN the more button is clicked for a specific experience
      const moreButton = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)[0];
      await userEvent.click(moreButton);
      // AND the delete button is clicked
      const deleteButton = screen.getAllByTestId(MENU_ITEM_ID.DELETE)[0];
      await userEvent.click(deleteButton);

      // THEN expect a confirmation dialog to be shown
      const confirmDialog = await screen.findByTestId(DATA_TEST_ID.DELETE_EXPERIENCE_DIALOG);
      expect(confirmDialog).toBeInTheDocument();

      // WHEN the confirmation button is clicked
      const confirmButton = screen.getAllByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL_CONFIRM)[1];
      await userEvent.click(confirmButton);

      // THEN expect the service to be called
      expect(deleteSpy).toHaveBeenCalledWith(givenSessionId, mockExperiences[0].UUID);
      expect(onExperiencesUpdated).toHaveBeenCalled();
      // AND the snackbar to be displayed
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Experience deleted successfully!", {
        variant: "success",
      });
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      { element: "cancel button", testId: CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL_CANCEL },
      { element: "close icon", testId: CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL_CLOSE },
    ])("should not delete experience when $element in confirmation dialog is clicked", async ({ testId }) => {
      const deleteExperienceMock = jest.spyOn(ExperienceService.prototype, "deleteExperience").mockResolvedValueOnce();

      // GIVEN some experiences that have been explored
      const givenExploredExperiences = mockExperiences.map((experience) => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED,
      }));
      // AND a session ID that is set in user preferences
      const givenSessionId = 234;
      UserPreferencesStateService.getInstance().setUserPreferences({
        sessions: [givenSessionId],
      } as unknown as UserPreference);
      const onExperiencesUpdated = jest.fn();
      // AND the component is rendered
      render(
        <ExperiencesDrawer
          isOpen={true}
          isLoading={false}
          experiences={givenExploredExperiences}
          notifyOnClose={jest.fn()}
          conversationConductedAt="2022-06-01T00:00:00Z"
          onExperiencesUpdated={onExperiencesUpdated}
        />
      );

      // WHEN the more button is clicked for a specific experience
      const moreButton = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)[0];
      await userEvent.click(moreButton);
      // AND the delete button is clicked
      const deleteButton = screen.getAllByTestId(MENU_ITEM_ID.DELETE)[0];
      await userEvent.click(deleteButton);

      // THEN expect a confirmation dialog to be shown
      const confirmDialog = await screen.findByTestId(DATA_TEST_ID.DELETE_EXPERIENCE_DIALOG);
      expect(confirmDialog).toBeInTheDocument();

      // WHEN the specified element in the confirmation dialog is clicked
      const element = screen.getAllByTestId(testId)[1];
      await userEvent.click(element);

      // THEN expect the service to not be called
      expect(deleteExperienceMock).not.toHaveBeenCalled();
      expect(onExperiencesUpdated).not.toHaveBeenCalled();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should handle error when deleteExperience fails", async () => {
      // GIVEN some experiences that have been explored
      const givenExploredExperiences = mockExperiences.map((experience) => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED,
      }));
      // AND a session ID that is set in user preferences
      const givenSessionId = 234;
      UserPreferencesStateService.getInstance().setUserPreferences({
        sessions: [givenSessionId],
      } as unknown as UserPreference);
      const onExperiencesUpdated = jest.fn();
      // AND the component is rendered
      render(
        <ExperiencesDrawer
          isOpen={true}
          isLoading={false}
          experiences={givenExploredExperiences}
          notifyOnClose={jest.fn()}
          conversationConductedAt="2022-06-01T00:00:00Z"
          onExperiencesUpdated={onExperiencesUpdated}
        />
      );
      // AND a mocked service that rejects
      jest.spyOn(ExperienceService.prototype, "deleteExperience").mockRejectedValueOnce(new Error("Delete failed"));

      // WHEN the more button is clicked for a specific experience
      const moreButton = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)[0];
      await userEvent.click(moreButton);
      // AND the delete button is clicked
      const deleteButton = screen.getAllByTestId(MENU_ITEM_ID.DELETE)[0];
      await userEvent.click(deleteButton);

      // THEN expect a confirmation dialog to be shown
      const confirmDialog = await screen.findByTestId(DATA_TEST_ID.DELETE_EXPERIENCE_DIALOG);
      expect(confirmDialog).toBeInTheDocument();

      // WHEN the confirmation button is clicked
      const confirmButton = screen.getAllByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL_CONFIRM)[1];
      await userEvent.click(confirmButton);

      // THEN expect error snackbar to be displayed
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        "An unexpected error occurred. Please try again later.",
        { variant: "error" }
      );
    });
  });

  describe("Restore to Unedited", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });
    test("should restore experience to unedited successfully when restore to unedited button is clicked", async () => {
      // GIVEN some experiences that have been explored
      const givenExploredExperiences = mockExperiences.map((experience) => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED,
      }));
      // AND a session ID that is set in user preferences
      const givenSessionId = 234;
      UserPreferencesStateService.getInstance().setUserPreferences({
        sessions: [givenSessionId],
      } as unknown as UserPreference);
      const onExperiencesUpdated = jest.fn();
      // AND mocked services that resolve
      const getUneditedExperienceSpy = jest
        .spyOn(ExperienceService.getInstance(), "getUneditedExperience")
        .mockResolvedValueOnce(givenExploredExperiences[0]);
      const updateExperienceSpy = jest
        .spyOn(ExperienceService.getInstance(), "updateExperience")
        .mockResolvedValueOnce(givenExploredExperiences[0]);
      // AND the component is rendered
      render(
        <ExperiencesDrawer
          isOpen={true}
          isLoading={false}
          experiences={givenExploredExperiences}
          notifyOnClose={jest.fn()}
          conversationConductedAt="2022-06-01T00:00:00Z"
          onExperiencesUpdated={onExperiencesUpdated}
        />
      );
      // WHEN the more button is clicked for a specific experience
      const moreButton = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)[0];
      await userEvent.click(moreButton);
      // AND the restore to original button is clicked
      const restoreToOriginalButton = screen.getAllByTestId(MENU_ITEM_ID.RESTORE_TO_ORIGINAL)[0];
      await userEvent.click(restoreToOriginalButton);
      // THEN expect a confirmation dialog to be shown
      const confirmDialog = await screen.findByTestId(DATA_TEST_ID.RESTORE_TO_ORIGINAL_CONFIRM_DIALOG);
      expect(confirmDialog).toBeInTheDocument();
      // WHEN the confirmation button is clicked
      const confirmButton = within(confirmDialog).getByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL_CONFIRM);
      await userEvent.click(confirmButton);
      // THEN expect the services to be called with the correct parameters
      expect(getUneditedExperienceSpy).toHaveBeenCalledWith(givenSessionId, mockExperiences[0].UUID);
      expect(updateExperienceSpy).toHaveBeenCalledWith(
        givenSessionId,
        mockExperiences[0].UUID,
        expect.objectContaining({
          experience_title: mockExperiences[0].experience_title,
          timeline: mockExperiences[0].timeline,
          company: mockExperiences[0].company,
          location: mockExperiences[0].location,
          work_type: mockExperiences[0].work_type,
          summary: mockExperiences[0].summary,
          top_skills: expect.arrayContaining([
            expect.objectContaining({
              UUID: mockExperiences[0].top_skills[0].UUID,
              preferredLabel: mockExperiences[0].top_skills[0].preferredLabel,
            }),
          ]),
        })
      );
      expect(onExperiencesUpdated).toHaveBeenCalled();
      // AND the snackbar to be displayed
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Experience restored successfully!", {
        variant: "success",
      });
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should handle error when restore to unedited fails", async () => {
      // GIVEN some experiences that have been explored
      const givenExploredExperiences = mockExperiences.map((experience) => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED,
      }));
      // AND a session ID that is set in user preferences
      const givenSessionId = 234;
      UserPreferencesStateService.getInstance().setUserPreferences({
        sessions: [givenSessionId],
      } as unknown as UserPreference);
      const onExperiencesUpdated = jest.fn();
      // AND a mocked service that rejects
      const givenError = new Error("API Error");
      jest.spyOn(ExperienceService.getInstance(), "getUneditedExperience").mockRejectedValueOnce(givenError);
      // AND the component is rendered
      render(
        <ExperiencesDrawer
          isOpen={true}
          isLoading={false}
          experiences={givenExploredExperiences}
          notifyOnClose={jest.fn()}
          conversationConductedAt="2022-06-01T00:00:00Z"
          onExperiencesUpdated={onExperiencesUpdated}
        />
      );
      // WHEN the more button is clicked for a specific experience
      const moreButton = screen.getAllByTestId(EXPERIENCES_DRAWER_CONTENT_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON)[0];
      await userEvent.click(moreButton);
      // AND the restore to original button is clicked
      const restoreToOriginalButton = screen.getAllByTestId(MENU_ITEM_ID.RESTORE_TO_ORIGINAL)[0];
      await userEvent.click(restoreToOriginalButton);
      // THEN expect a confirmation dialog to be shown
      const confirmDialog = await screen.findByTestId(DATA_TEST_ID.RESTORE_TO_ORIGINAL_CONFIRM_DIALOG);
      expect(confirmDialog).toBeInTheDocument();
      // WHEN the confirmation button is clicked
      const confirmButton = within(confirmDialog).getByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL_CONFIRM);
      await userEvent.click(confirmButton);
      // THEN expect the snackbar to be displayed with error message
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to restore experience.", {
        variant: "error",
      });
      // AND expect onExperiencesUpdated to not have been called
      expect(onExperiencesUpdated).not.toHaveBeenCalled();
      // AND no errors or warnings to have occurred
      expect(console.error).toHaveBeenCalledWith(new ExperienceError("Failed to restore experience:", givenError));
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("Restore Deleted Experiences Drawer integration", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should open restore drawer when link is clicked and close when Go Back is clicked", async () => {
      // GIVEN the ExperiencesDrawer component
      const onExperiencesUpdated = jest.fn();
      // AND a mocked service that resolves
      jest.spyOn(ExperienceService.getInstance(), "getExperiences").mockResolvedValueOnce([]);
      render(
        <ExperiencesDrawer
          isOpen={true}
          isLoading={false}
          experiences={[]}
          notifyOnClose={jest.fn()}
          conversationConductedAt="2022-06-01T00:00:00Z"
          onExperiencesUpdated={onExperiencesUpdated}
        />
      );
      // WHEN the restore link is clicked
      const restoreLink = screen.getByTestId(DATA_TEST_ID.RESTORE_DELETED_EXPERIENCES_LINK);
      await userEvent.click(restoreLink);
      // THEN the restore drawer is shown
      expect(screen.getByTestId(RESTORE_EXPERIENCES_DRAWER_DATA_TEST_ID.RESTORE_EXPERIENCES)).toBeInTheDocument();
      // WHEN Go Back is clicked
      const goBackButton = await screen.findByTestId(
        RESTORE_EXPERIENCES_DRAWER_DATA_TEST_ID.RESTORE_EXPERIENCES_GO_BACK_BUTTON
      );
      await userEvent.click(goBackButton);
      // THEN the main drawer content is shown again
      await waitFor(async () => {
        expect(screen.getByTestId(DATA_TEST_ID.PERSONAL_INFORMATION_TITLE)).toBeInTheDocument();
      });
    });

    test("should restore a deleted experience and close the restore drawer", async () => {
      // GIVEN a session ID that is set in user preferences
      const givenSessionId = 234;
      UserPreferencesStateService.getInstance().setUserPreferences({
        sessions: [givenSessionId],
      } as unknown as UserPreference);
      const onExperiencesUpdated = jest.fn();
      // AND a mocked service that resolves
      const currentExperiences = [mockExperiences[0]];
      const deletedExperiences = [mockExperiences[1]];
      jest
        .spyOn(ExperienceService.getInstance(), "getExperiences")
        .mockResolvedValueOnce([...currentExperiences, ...deletedExperiences]);
      render(
        <ExperiencesDrawer
          isOpen={true}
          isLoading={false}
          experiences={currentExperiences}
          notifyOnClose={jest.fn()}
          conversationConductedAt="2022-06-01T00:00:00Z"
          onExperiencesUpdated={onExperiencesUpdated}
        />
      );
      // WHEN the restore link is clicked
      const restoreLink = screen.getByTestId(DATA_TEST_ID.RESTORE_DELETED_EXPERIENCES_LINK);
      await userEvent.click(restoreLink);
      // THEN the restore drawer is shown
      expect(screen.getByTestId(RESTORE_EXPERIENCES_DRAWER_DATA_TEST_ID.RESTORE_EXPERIENCES)).toBeInTheDocument();
    });
  });
});
