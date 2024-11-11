// silence chatty console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import RegistrationCodeFormModal, { DATA_TEST_ID, RegistrationCodeFormModalState } from "./RegistrationCodeFormModal";

// Mock InvitationsService
jest.mock("src/auth/services/invitationsService/invitations.service", () => ({
  getInstance: jest.fn().mockReturnValue({
    checkInvitationCodeStatus: jest.fn(),
  }),
}));

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

describe("RegistrationCodeFormModal", () => {
  it("renders correctly when modal is shown and call onSuccess with the provided code", () => {
    // GIVEN the component is shown
    const givenShown = RegistrationCodeFormModalState.SHOW;

    // AND the onClose function is a jest function
    const givenOnSuccess = jest.fn();

    // WHEN the component is rendered
    render(<RegistrationCodeFormModal onClose={jest.fn} modalState={givenShown} onSuccess={givenOnSuccess} />);

    // THEN the component should render correctly
    const container = screen.getByTestId(DATA_TEST_ID.CONTAINER);
    expect(container).toBeInTheDocument();

    // AND the component should contain the necessary elements
    expect(screen.getByTestId(DATA_TEST_ID.MODAL_TITLE)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.MODAL_SUBTITLE)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.INVITATION_CODE_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.CLOSE_ICON)).toBeInTheDocument();

    // AND the component should match the snapshot
    expect(container).toMatchSnapshot();

    // WHEN the registration code is entered
    const registrationCode = "foo";
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.INVITATION_CODE_INPUT), { target: { value: registrationCode } });

    // AND the registration code is submitted
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON));

    // THEN the onSuccess function should be called with the registration code
    expect(givenOnSuccess).toHaveBeenCalledWith(registrationCode);
  });
  test("closes the modal when the close icon is clicked", () => {
    // GIVEN the component is shown
    const givenShown = RegistrationCodeFormModalState.SHOW;

    // AND the onClose function is a jest function
    const givenOnClose = jest.fn();

    // WHEN the component is rendered
    render(<RegistrationCodeFormModal onClose={givenOnClose} modalState={givenShown} onSuccess={jest.fn()} />);

    // THEN the component should render correctly
    const container = screen.getByTestId(DATA_TEST_ID.CONTAINER);
    expect(container).toBeInTheDocument();

    // AND the component should contain the necessary elements
    expect(screen.getByTestId(DATA_TEST_ID.MODAL_TITLE)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.MODAL_SUBTITLE)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.INVITATION_CODE_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.CLOSE_ICON)).toBeInTheDocument();

    // AND the component should match the snapshot
    expect(container).toMatchSnapshot();

    // WHEN the close icon is clicked
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.CLOSE_ICON));

    // THEN the onClose function should be called
    expect(givenOnClose).toHaveBeenCalled();
  });
});
