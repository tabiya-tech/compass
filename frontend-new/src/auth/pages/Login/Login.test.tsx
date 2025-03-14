// standard sentry mock
import "src/_test_utilities/sentryMock"
import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor, fireEvent, act } from "src/_test_utilities/test-utils";
import Login, { DATA_TEST_ID } from "./Login";
import LoginWithEmailForm from "src/auth/pages/Login/components/LoginWithEmailForm/LoginWithEmailForm";
import LoginWithInviteCodeForm from "./components/LoginWithInviteCodeForm/LoginWithInviteCodeForm";
import FirebaseEmailAuthenticationService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import FirebaseInvitationCodeAuthenticationService
  from "src/auth/services/FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService";
import * as Sentry from "@sentry/react";
import { DATA_TEST_ID as BUG_REPORT_DATA_TEST_ID } from "src/feedback/bugReport/bugReportButton/BugReportButton";
import { DATA_TEST_ID as REQUEST_INVITATION_CODE_DATA_TEST_ID} from "src/auth/components/requestInvitationCode/RequestInvitationCode";
import { FirebaseError } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import ResendVerificationEmail, { DATA_TEST_ID as RESEND_DATA_TEST_ID } from "src/auth/components/resendVerificationEmail/ResendVerificationEmail"
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";

// Mock the Firebase service
jest.mock("src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service", () => ({
  getInstance: jest.fn(),
}));

jest.mock("src/envService", () => ({
  getFirebaseAPIKey: jest.fn(() => "mock-api-key"),
  getFirebaseDomain: jest.fn(() => "mock-auth-domain"),
  getBackendUrl: jest.fn(() => "mock-backend-url"),
}));

jest.mock("src/auth/components/SocialAuth/SocialAuth", () => {
  const actual = jest.requireActual("src/auth/components/SocialAuth/SocialAuth");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.FIREBASE_AUTH_CONTAINER}></span>;
    }),
  };
});

jest.mock("src/auth/services/Authentication.service.factory", () => {
  const actual = jest.requireActual("src/auth/services/Authentication.service.factory");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        login: jest.fn(),
      };
    }),
  };
});

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

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    __esModule: true,
    useNavigate: jest.fn().mockReturnValue(jest.fn()),
    NavLink: jest.fn().mockImplementation(() => {
      return <></>;
    }),
  };
});

jest.mock("src/auth/pages/Login/components/LoginWithEmailForm/LoginWithEmailForm", () => {
  const actual = jest.requireActual("src/auth/pages/Login/components/LoginWithEmailForm/LoginWithEmailForm");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.FORM}></span>;
    }),
  };
});

jest.mock("./components/LoginWithInviteCodeForm/LoginWithInviteCodeForm", () => {
  const actual = jest.requireActual("./components/LoginWithInviteCodeForm/LoginWithInviteCodeForm");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.FORM}></span>;
    }),
  };
});

jest.mock("src/feedback/bugReport/bugReportButton/BugReportButton", () => {
  const actual = jest.requireActual("src/feedback/bugReport/bugReportButton/BugReportButton");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.BUG_REPORT_BUTTON_CONTAINER}></span>;
    }),
  };
});

// mock the RequestInvitationCode component
jest.mock("src/auth/components/requestInvitationCode/RequestInvitationCode", () => {
  const actual = jest.requireActual(
    "src/auth/components/requestInvitationCode/RequestInvitationCode"
  );
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.REQUEST_INVITATION_CODE_LINK}></span>;
    }),
  };
});

jest.mock("src/auth/components/resendVerificationEmail/ResendVerificationEmail", () => {
  const actual = jest.requireActual("src/auth/components/resendVerificationEmail/ResendVerificationEmail");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.CONTAINER}></span>;
    }),
  };
});

describe("Testing Login component", () => {
  const mockLogin = jest.fn();
  const mockLogout = jest.fn();

  // Setup before each test
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock the Firebase service instance
    (FirebaseEmailAuthenticationService.getInstance as jest.Mock).mockReturnValue({
      login: mockLogin,
      logout: mockLogout,
    });

    jest.useFakeTimers(); // Use Jest's fake timers

    mockBrowserIsOnLine(true);
  });

  test("it should show login form successfully", async () => {
    // GIVEN sentry is initialized
    (Sentry.isInitialized as jest.Mock).mockReturnValue(true);

    // GIVEN the component is rendered within necessary context providers
    render(<Login />);

    // THEN expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // THEN the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toBeInTheDocument();
    // AND expect the bug report button to be rendered
    expect(screen.getByTestId(BUG_REPORT_DATA_TEST_ID.BUG_REPORT_BUTTON_CONTAINER)).toBeInTheDocument();
    // AND the request registration code link should be displayed
    expect(screen.getByTestId(REQUEST_INVITATION_CODE_DATA_TEST_ID.REQUEST_INVITATION_CODE_LINK)).toBeInTheDocument();

    // THEN the email login form should be displayed
    expect(LoginWithEmailForm).toHaveBeenCalled();

    // THEN the invite code login form should be displayed
    expect(LoginWithInviteCodeForm).toHaveBeenCalled();
    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toMatchSnapshot();
  });

  test("it should handle email login correctly", async () => {
    // GIVEN an email and password
    const givenEmail = "foo@bar.baz";
    const givenPassword = "Pa$$word123";

    // AND the email login mock will succeed
    const loginMock = jest.fn();
    jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
      login: loginMock,
    } as unknown as FirebaseEmailAuthenticationService);

    render(<Login />);

    // WHEN the user fills in their email and password
    act(() => {
      (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnEmailChanged(givenEmail);
      (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnPasswordChanged(givenPassword);
    });

    // AND clicks the login button
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // THEN the loginWithEmail function should be called with the correct arguments
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith(givenEmail, givenPassword);
    });
    // AND expect no errors or warnings to be logged
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("it should handle invitation code login correctly", async () => {
    // GIVEN an invitation code
    const givenInvitationCode = "INVITE-CODE-123";
    // AND the anonymous auth mock will succeed
    const anonymousLoginMock = jest.fn().mockResolvedValue("mock-token");
    jest.spyOn(FirebaseInvitationCodeAuthenticationService, "getInstance").mockReturnValue({
      login: anonymousLoginMock,
    } as unknown as FirebaseInvitationCodeAuthenticationService);

    render(<Login />);

    // WHEN the user fills in their invitation code
    act(() => {
      (LoginWithInviteCodeForm as jest.Mock).mock.calls[0][0].notifyOnInviteCodeChanged(givenInvitationCode);
    });

    // AND clicks the login button
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // AND the anonymousAuthService should be called with the correct arguments
    await waitFor(() => {
      expect(anonymousLoginMock).toHaveBeenCalledWith(givenInvitationCode);
    });
    // AND expect no errors or warnings to be logged
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should show ResendVerificationEmail component when email is not verified", async () => {
    // GIVEN an email and password
    const givenEmail = "foo@bar.baz";
    const givenPassword = "Pa$$word123";

    // AND the email login will fail with EMAIL_NOT_VERIFIED error
    const loginMock = jest.fn().mockRejectedValue(new FirebaseError(
      "firebaseEmailAuthenticationService",
      "login",
      "POST",
      FirebaseErrorCodes.EMAIL_NOT_VERIFIED,
      "Email not verified"
      )
    );

    jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
      login: loginMock,
      logout: mockLogout,
    } as unknown as FirebaseEmailAuthenticationService);

    // WHEN the component is rendered
    render(<Login />);

    // AND the user fills in their email and password
    act(() => {
      (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnEmailChanged(givenEmail);
      (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnPasswordChanged(givenPassword);
    });

    // AND submits the form
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // THEN the ResendVerificationEmail component should be shown
    await waitFor(() => {
      expect(screen.getByTestId(RESEND_DATA_TEST_ID.CONTAINER)).toBeInTheDocument();
    });

    // AND it should be passed the correct props
    expect(ResendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: givenEmail,
        password: givenPassword,
      }),
      expect.any(Object)
    );
  });

  test("should enable/disable the login button when the browser online status changes", async () => {
    // GIVEN the browser is offline
    mockBrowserIsOnLine(false);

    // AND an email and password
    const givenEmail = "foo@bar.baz";
    const givenPassword = "Pa$$word123";

    // WHEN the component is rendered
    render(<Login />);

     // WHEN the user fills in their email and password
     act(() => {
      (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnEmailChanged(givenEmail);
      (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnPasswordChanged(givenPassword);
    });

    // THEN the login button should be disabled
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON)).toBeDisabled();
    });
    
    // AND the browser is online
    mockBrowserIsOnLine(true);

    // THEN the login button should be enabled
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON)).toBeEnabled();
    });

    // AND expect no errors or warnings to be logged
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
