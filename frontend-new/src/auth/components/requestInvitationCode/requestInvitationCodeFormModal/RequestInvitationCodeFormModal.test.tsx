// mute the console
import "src/_test_utilities/consoleMock";

import * as SentryInvitationCodeRequestService from "src/auth/components/requestInvitationCode/requestInvitationCodeService/SentryInvitationCodeRequest.service"
import { render, screen } from "src/_test_utilities/test-utils";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import userEvent from "@testing-library/user-event";
import RequestInvitationCodeFormModal, {
  DATA_TEST_ID,
} from "src/auth/components/requestInvitationCode/requestInvitationCodeFormModal/RequestInvitationCodeFormModal";

import { mockBrowserIsOnLine, unmockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { RequestInvitationCodeError } from "src/error/commonErrors";

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

describe("RequestInvitationCodeFormModal", () => {
  beforeEach(() => {
    unmockBrowserIsOnLine();
  })
  test("should render modal correctly when open", () => {
    // GIVEN the nodal is open
    const givenOpen = true;
    // AND the onClose function
    const givenOnClose = jest.fn();
    // AND the internet is online
    mockBrowserIsOnLine(true);

    // WHEN the component is rendered
    render(<RequestInvitationCodeFormModal open={givenOpen} onClose={givenOnClose} />);

    // THEN expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the component should render correctly
    const container = screen.getByTestId(DATA_TEST_ID.CONTAINER);
    expect(container).toBeInTheDocument();
    // AND the close icon should be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CLOSE_ICON)).toBeInTheDocument();
    // AND the modal title should be in the document
    expect(screen.getByTestId(DATA_TEST_ID.MODAL_TITLE)).toBeInTheDocument();
    // AND the modal subtitle should be in the document
    expect(screen.getByTestId(DATA_TEST_ID.MODAL_SUBTITLE)).toBeInTheDocument();
    // AND the name input should be in the document
    expect(screen.getByTestId(DATA_TEST_ID.NAME_INPUT)).toBeInTheDocument();
    // AND the email input should be in the document
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeInTheDocument();
    // AND the message input should be in the document
    expect(screen.getByTestId(DATA_TEST_ID.MESSAGE_INPUT)).toBeInTheDocument();
    // AND the submit button should be in the document
    expect(screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON)).toBeInTheDocument();
    // AND the component should match the snapshot
    expect(container).toMatchSnapshot();
  });

  test("should close the modal when the close icon is clicked", async () => {
    // GIVEN the modal is open
    const givenOpen = true;
    // AND the onClose function
    const givenOnClose = jest.fn();
    // AND the internet is online
    mockBrowserIsOnLine(true);
    // AND the component is rendered
    render(<RequestInvitationCodeFormModal open={givenOpen} onClose={givenOnClose} />);

    // WHEN the close icon is clicked
    const closeIcon = screen.getByTestId(DATA_TEST_ID.CLOSE_ICON);
    await userEvent.click(closeIcon);

    // THEN the onClose function should be called
    expect(givenOnClose).toHaveBeenCalled();
  });

  test("should send user information to Sentry when the submit button is clicked", async () => {
    // GIVEN a sentry invitationCode service that successfully captures user feedback
    const mockRequestInvitationCode = jest.spyOn(SentryInvitationCodeRequestService, "requestInvitationCode").mockImplementation(jest.fn());
    // AND the modal is open
    const givenOpen = true;
    // AND the internet is online
    mockBrowserIsOnLine(true);
    // AND the component is rendered
    render(<RequestInvitationCodeFormModal open={givenOpen} onClose={jest.fn()} />);
    // AND all the fields are filled
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.NAME_INPUT), "John Doe");
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), "john.doe@example.com");
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.MESSAGE_INPUT), "I want to explore my skills");

    // WHEN the submit button is clicked
    const submitButton = screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON);
    await userEvent.click(submitButton);

    // THEN sentry invitationCode service should be called with the correct arguments
    expect(mockRequestInvitationCode).toHaveBeenCalledWith({
      name: "John Doe",
      email: "john.doe@example.com",
      message: "I want to explore my skills",
    });
    // AND the notification should be displayed
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
      "Your request for access to Brujula has been submitted successfully. We will get back to you soon.",
      { variant: "success" }
    );
  });

  test("should show a notification and log an error when the invitation code service throws an error", async () => {
    // GIVEN a sentry invitationCode service that fails to capture feedback with an error
    const givenError = new RequestInvitationCodeError("foo error");
    const mockRequestInvitationCode = jest.spyOn(SentryInvitationCodeRequestService, "requestInvitationCode").mockImplementation(() => {
      throw givenError;
    });
    // AND the modal is open
    const givenOpen = true;
    // AND the internet is online
    mockBrowserIsOnLine(true);
    // AND the component is rendered
    render(<RequestInvitationCodeFormModal open={givenOpen} onClose={jest.fn()} />);
    // AND all the fields are filled
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.NAME_INPUT), "John Doe");
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), "john.doe@example.com");
    await userEvent.type(screen.getByTestId(DATA_TEST_ID.MESSAGE_INPUT), "I want to explore my skills");

    // WHEN the submit button is clicked
    const submitButton = screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON);
    await userEvent.click(submitButton);

    // THEN sentry invitationCode service should be called with the correct arguments
    expect(mockRequestInvitationCode).toHaveBeenCalledWith({
      name: "John Doe",
      email: "john.doe@example.com",
      message: "I want to explore my skills",
    });
    // AND the notification should be displayed for the failure
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
      "Something went wrong while attempting to send your request",
      { variant: "error" }
    );
    // AND a console error should be shown
    expect(console.error).toHaveBeenCalledWith(givenError)
  });

  test("should not allow the user to submit the form when the internet is offline", async () => {
    // GIVEN the internet is offline
    mockBrowserIsOnLine(false);
    // AND the component is rendered
    render(<RequestInvitationCodeFormModal open={true} onClose={jest.fn()} />);
    // THEN the submit button should be disabled
    const submitButton = screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON);
    expect(submitButton).toBeDisabled();
  });
});

