// silence chatty console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen, fireEvent, waitFor } from "src/_test_utilities/test-utils";
import RegistrationCodeFormModal, { DATA_TEST_ID } from "./RegistrationCodeFormModal";
import InvitationsService from "src/invitations/InvitationsService/invitations.service";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";

// Mock InvitationsService
jest.mock("src/invitations/InvitationsService/invitations.service", () => ({
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
  const setUpMocks = () => {
    const enqueueSnackbar = jest.fn();

    (useSnackbar as jest.Mock).mockReturnValue({ enqueueSnackbar });

    const checkInvitationCodeStatus = jest.fn();

    const invitationsServiceInstance = InvitationsService.getInstance();
    invitationsServiceInstance.checkInvitationCodeStatus = checkInvitationCodeStatus;

    return { enqueueSnackbar, checkInvitationCodeStatus };
  };

  it("renders correctly when modal is shown", () => {
    // GIVEN the component is shown
    const givenShown = true;

    // AND the onClose function is a jest function
    const onClose = jest.fn();

    // WHEN the component is rendered
    render(<RegistrationCodeFormModal show={givenShown} onSuccess={jest.fn()} onClose={onClose} />);

    // THEN the component should render correctly
    const container = screen.getByTestId(DATA_TEST_ID.CONTAINER);
    expect(container).toBeInTheDocument();

    // AND the component should contain the necessary elements
    expect(screen.getByTestId(DATA_TEST_ID.MODAL_TITLE)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.MODAL_SUBTITLE)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.INVITATION_CODE_INPUT)).toBeInTheDocument();

    // AND the component should match the snapshot
    expect(container).toMatchSnapshot();
  });

  it("calls onClose when valid registration code is entered", async () => {
    const { checkInvitationCodeStatus } = setUpMocks();

    // GIVEN the component is shown
    const givenShown = true;

    // AND the checkInvitationCodeStatus resolves with a valid code
    checkInvitationCodeStatus.mockResolvedValueOnce({ code: "valid-code" });

    // AND the onClose function is a jest function
    const onClose = jest.fn();

    // WHEN the component is rendered
    render(<RegistrationCodeFormModal onSuccess={jest.fn()} show={givenShown} onClose={onClose} />);

    // AND the user enters a valid code and clicks the validate button
    const input = screen.getByTestId(DATA_TEST_ID.INVITATION_CODE_INPUT);

    // AND the validate button is clicked
    const button = screen.getByRole("button", { name: /validate/i });

    fireEvent.change(input, { target: { value: "valid-code" } });
    fireEvent.click(button);

    // THEN the invitation code should be validated
    await waitFor(() => {
      expect(checkInvitationCodeStatus).toHaveBeenCalledWith("valid-code", expect.any(Function), expect.any(Function));
    });
  });

  it("shows error snackbar when invalid registration code is entered", async () => {
    const { checkInvitationCodeStatus, enqueueSnackbar } = setUpMocks();

    // GIVEN the component is shown
    const givenShown = true;

    // AND the checkInvitationCodeStatus rejects with an error
    checkInvitationCodeStatus.mockRejectedValueOnce(new Error("Invalid code"));

    // AND the onClose function is a jest function
    const onClose = jest.fn();

    // WHEN the component is rendered
    render(<RegistrationCodeFormModal onSuccess={jest.fn()} show={givenShown} onClose={onClose} />);

    const input = screen.getByTestId(DATA_TEST_ID.INVITATION_CODE_INPUT);
    const button = screen.getByRole("button", { name: /validate/i });

    fireEvent.change(input, { target: { value: "invalid-code" } });

    // AND the validate button is clicked
    fireEvent.click(button);

    // THEN the invitation code should be validated
    await waitFor(() => {
      expect(checkInvitationCodeStatus).toHaveBeenCalledWith(
        "invalid-code",
        expect.any(Function),
        expect.any(Function)
      );
    });

    await waitFor(() => {
      expect(enqueueSnackbar).toHaveBeenCalledWith("Invalid registration code", { variant: "error" });
    });
  });

  it("disables button while validating", async () => {
    const { checkInvitationCodeStatus } = setUpMocks();

    // GIVEN the component is shown
    const givenShown = true;

    // AND the checkInvitationCodeStatus resolves with a valid code after 100ms
    checkInvitationCodeStatus.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ code: "valid-code" }), 100))
    );

    // AND the onClose function is a jest function
    const onClose = jest.fn();

    // WHEN the component is rendered
    render(<RegistrationCodeFormModal onSuccess={jest.fn()} show={givenShown} onClose={onClose} />);

    const input = screen.getByTestId(DATA_TEST_ID.INVITATION_CODE_INPUT);
    const button = screen.getByRole("button", { name: /validate/i });

    // AND the validate button is clicked
    fireEvent.change(input, { target: { value: "valid-code" } });
    fireEvent.click(button);

    // THEN the button should be disabled while validating
    expect(button).toBeDisabled();

    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
