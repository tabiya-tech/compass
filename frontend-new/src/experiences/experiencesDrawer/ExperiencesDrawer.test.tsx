// mute the console
import "src/_test_utilities/consoleMock";

import ExperiencesDrawer, { DATA_TEST_ID } from "src/experiences/experiencesDrawer/ExperiencesDrawer";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, within } from "src/_test_utilities/test-utils";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import {
  DATA_TEST_ID as EXPERIENCES_DRAWER_HEADER_TEST_ID,
} from "src/experiences/experiencesDrawer/components/experiencesDrawerHeader/ExperiencesDrawerHeader";
import {
  DATA_TEST_ID as EXPERIENCES_DRAWER_CONTENT_TEST_ID,
  MENU_ITEM_ID,
} from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import { DATA_TEST_ID as CONFIRM_MODAL_DIALOG_DATA_TEST_ID } from "src/theme/confirmModalDialog/ConfirmModalDialog";
import { DATA_TEST_ID as EXPERIENCE_EDIT_FORM_DATA_TEST_ID } from "src/experiences/experiencesDrawer/components/experienceEditForm/ExperienceEditForm";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import { DiveInPhase } from "../experienceService/experiences.types";

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
  const mockConfirmModalDialog = jest.fn().mockImplementation(({ onConfirm, onCancel, onDismiss, isOpen }) => (
    <div data-testid={actual.DATA_TEST_ID.CONFIRM_MODAL}>
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

describe("ExperiencesDrawer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      const givenExploredExperiences = mockExperiences.map(experience => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED
      }))
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
      const givenExploredExperiences = mockExperiences.map(experience => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED
      }))
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
      expect(screen.getByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL)).toBeInTheDocument();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should keep ExperienceEditForm open when Keep Editing button in the dialog is clicked", async () => {
      // GIVEN some experiences that have been explored
      const givenExploredExperiences = mockExperiences.map(experience => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED
      }))
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

      // WHEN the edit button is clicked for a specific experience
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
      const confirmDialog = await screen.findByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL);
      expect(confirmDialog).toBeInTheDocument();

      // WHEN keep editing button in the confirmation dialog is clicked
      const keepEditButton = screen.getByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL_CONFIRM);
      await userEvent.click(keepEditButton);

      // THEN expect the ExperienceEditForm to still be visible
      expect(screen.getByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_CONTAINER)).toBeInTheDocument();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should close ExperienceEditForm when close button in the dialog is clicked", async () => {
      // GIVEN some experiences that have been explored
      const givenExploredExperiences = mockExperiences.map(experience => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED
      }))
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
      expect(screen.getByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL)).toBeInTheDocument();

      // WHEN the cancel button in the confirmation dialog is clicked
      const cancelButton = screen.getByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL_CANCEL);
      await userEvent.click(cancelButton);

      // THEN expect the ExperienceEditForm to be closed
      expect(screen.queryByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_CONTAINER)).not.toBeInTheDocument();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should keep ExperienceEditForm open when close icon in dialog is clicked", async () => {
      // GIVEN some experiences that have been explored
      const givenExploredExperiences = mockExperiences.map(experience => ({
        ...experience,
        exploration_phase: DiveInPhase.PROCESSED
      }))
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
      const confirmDialog = await screen.findByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL);
      expect(confirmDialog).toBeInTheDocument();

      // WHEN close icon in the confirmation dialog is clicked
      const closeIcon = screen.getByTestId(CONFIRM_MODAL_DIALOG_DATA_TEST_ID.CONFIRM_MODAL_CLOSE);
      await userEvent.click(closeIcon);

      // THEN expect the ExperienceEditForm to still be visible
      expect(screen.getByTestId(EXPERIENCE_EDIT_FORM_DATA_TEST_ID.FORM_CONTAINER)).toBeInTheDocument();
      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
