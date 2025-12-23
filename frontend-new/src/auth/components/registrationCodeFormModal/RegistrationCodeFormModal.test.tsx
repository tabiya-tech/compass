// silence chatty console
import "src/_test_utilities/consoleMock";

// Mock Sentry
import "src/_test_utilities/sentryMock";

import React from "react";
import { render, screen, fireEvent, act } from "src/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import RegistrationCodeFormModal, {
  DATA_TEST_ID,
  RegistrationCodeFormModalState,
} from "src/auth/components/registrationCodeFormModal/RegistrationCodeFormModal";
import RequestInvitationCodeFormModal from "src/auth/components/requestInvitationCode/requestInvitationCodeFormModal/RequestInvitationCodeFormModal";
import * as Sentry from "@sentry/react";

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

// mock the RequestInvitationFormModal component
jest.mock(
  "src/auth/components/requestInvitationCode/requestInvitationCodeFormModal/RequestInvitationCodeFormModal",
  () => {
    const actual = jest.requireActual(
      "src/auth/components/requestInvitationCode/requestInvitationCodeFormModal/RequestInvitationCodeFormModal"
    );
    return {
      ...actual,
      __esModule: true,
      default: jest.fn().mockImplementation(() => {
        return <span data-testid={actual.DATA_TEST_ID.CONTAINER}></span>;
      }),
    };
  }
);

describe("RegistrationCodeFormModal", () => {
  test("renders correctly when modal is shown and call onSuccess with the provided code", () => {
    // GIVEN the component is shown
    const givenShown = RegistrationCodeFormModalState.SHOW;
    // AND GIVEN Sentry is initialized
    jest.spyOn(Sentry, "isInitialized").mockReturnValue(true);

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
    expect(screen.getByTestId(DATA_TEST_ID.REQUEST_REGISTRATION_CODE_LINK)).toBeInTheDocument();

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

  test("should show request registration code link when Sentry is initialized", () => {
    // GIVEN Sentry is initialized
    jest.spyOn(Sentry, "isInitialized").mockReturnValue(true);
    // AND the component is shown
    const givenShown = RegistrationCodeFormModalState.SHOW;

    // WHEN the component is rendered
    render(<RegistrationCodeFormModal onClose={jest.fn()} modalState={givenShown} onSuccess={jest.fn()} />);

    // THEN the request registration code link should be visible
    expect(screen.getByTestId(DATA_TEST_ID.REQUEST_REGISTRATION_CODE_LINK)).toBeInTheDocument();
  });

  test("should not show request registration code link when Sentry is not initialized", () => {
    // GIVEN Sentry is not initialized
    jest.spyOn(Sentry, "isInitialized").mockReturnValue(false);
    // AND the component is shown
    const givenShown = RegistrationCodeFormModalState.SHOW;

    // WHEN the component is rendered
    render(<RegistrationCodeFormModal onClose={jest.fn()} modalState={givenShown} onSuccess={jest.fn()} />);

    // THEN the request registration code link should not be visible
    expect(screen.queryByTestId(DATA_TEST_ID.REQUEST_REGISTRATION_CODE_LINK)).not.toBeInTheDocument();
  });

  test("should render CircularProgress when modal state is loading", () => {
    // GIVEN the component is in loading state
    const givenShown = RegistrationCodeFormModalState.LOADING;

    // AND the onClose function is a jest function
    const givenOnClose = jest.fn();

    // WHEN the component is rendered
    render(<RegistrationCodeFormModal onClose={givenOnClose} modalState={givenShown} onSuccess={jest.fn()} />);

    // THEN the circular progress should be in the document
    const circularProgress = screen.getByTestId(DATA_TEST_ID.PROGRESS_ELEMENT);
    expect(circularProgress).toBeInTheDocument();
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

    // WHEN the close icon is clicked
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.CLOSE_ICON));

    // THEN the onClose function should be called
    expect(givenOnClose).toHaveBeenCalled();
  });

  test("should show request invitation code modal when link is clicked and close it when onClose is called", async () => {
    // GIVEN the component is shown
    const givenShown = RegistrationCodeFormModalState.SHOW;
    const givenOnClose = jest.fn();
    // AND  GIVEN Sentry is initialized
    jest.spyOn(Sentry, "isInitialized").mockReturnValue(true);
    // AND the component is rendered
    render(<RegistrationCodeFormModal modalState={givenShown} onSuccess={jest.fn()} onClose={givenOnClose} />);
    // AND onClose mock
    const onCloseMock = (RequestInvitationCodeFormModal as jest.Mock).mock.calls[0][0].onClose;

    // WHEN the request invitation code link is clicked
    const requestRegistrationCodeLink = screen.getByTestId(DATA_TEST_ID.REQUEST_REGISTRATION_CODE_LINK);
    await userEvent.click(requestRegistrationCodeLink);

    // THEN expect the invitation code form modal to be closed
    expect(givenOnClose).toHaveBeenCalled();
    // AND the request registration form modal should be displayed
    expect(RequestInvitationCodeFormModal).toHaveBeenCalledWith(
      expect.objectContaining({ open: true }),
      expect.anything()
    );

    // WHEN the onClose function is called
    act(() => {
      onCloseMock();
    });

    // THEN the request invitation code form modal should be closed
    expect(RequestInvitationCodeFormModal).toHaveBeenCalledWith(
      expect.objectContaining({ open: false }),
      expect.anything()
    );
  });
});
