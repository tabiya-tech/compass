import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor, fireEvent, act } from "src/_test_utilities/test-utils";
import { HashRouter } from "react-router-dom";
import Login, { DATA_TEST_ID } from "./Login";
import { EmailAuthContext, TabiyaUser } from "src/auth/emailAuth/EmailAuthProvider/EmailAuthProvider";
import { InvitationsContext } from "src/invitations/InvitationsProvider/InvitationsProvider";
import { AnonymousAuthContext } from "src/auth/anonymousAuth/AnonymousAuthProvider/AnonymousAuthProvider";
import LoginWithEmailForm from "src/auth/pages/Login/components/LoginWithEmailForm/LoginWithEmailForm";
import LoginWithInviteCodeForm from "./components/LoginWithInviteCodeForm/LoginWithInviteCodeForm";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";

// Mock the necessary modules
jest.mock("src/envService", () => ({
  getFirebaseAPIKey: jest.fn(() => "mock-api-key"),
  getFirebaseDomain: jest.fn(() => "mock-auth-domain"),
  getBackendUrl: jest.fn(() => "mock-backend-url"),
}));

jest.mock("src/auth/components/IDPAuth/IDPAuth", () => {
  const actual = jest.requireActual("src/auth/components/IDPAuth/IDPAuth");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.FIREBASE_AUTH_CONTAINER}></span>;
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

describe("Testing Login component", () => {
  const loginWithEmailMock = jest.fn();
  const checkInvitationStatusMock = jest.fn();
  const loginAnonymouslyMock = jest.fn();

  const emailAuthContextValue = {
    loginWithEmail: loginWithEmailMock,
    isLoggingInWithEmail: false,
    isRegisteringWithEmail: false,
    isLoggingOut: false,
    user: null,
    registerWithEmail: jest.fn(),
    loginAnonymously: jest.fn(),
    logout: jest.fn(),
    handlePageLoad: jest.fn(),
  };

  const anonymousAuthContextValue = {
    loginAnonymously: loginAnonymouslyMock,
    user: null,
    isLoggingInAnonymously: false,
    isLoggingOut: false,
    logout: jest.fn(),
    handlePageLoad: jest.fn(),
  };

  const invitationsContextValue = {
    checkInvitationStatus: checkInvitationStatusMock,
    isInvitationCheckLoading: false,
    invitation: {
      code: "INVITE-CODE-123",
      status: InvitationStatus.VALID,
      invitation_type: InvitationType.AUTO_REGISTER,
    },
  };

  beforeEach(() => {
    // Clear mocks before each test
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  test("it should show login form successfully", async () => {
    // GIVEN the component is rendered within necessary context providers
    render(
      <HashRouter>
        <EmailAuthContext.Provider value={emailAuthContextValue}>
          <AnonymousAuthContext.Provider value={anonymousAuthContextValue}>
            <InvitationsContext.Provider value={invitationsContextValue}>
              <Login postLoginHandler={jest.fn()} isLoading={false} />
            </InvitationsContext.Provider>
          </AnonymousAuthContext.Provider>
        </EmailAuthContext.Provider>
      </HashRouter>
    );

    // THEN expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // THEN the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toBeInTheDocument();

    // THEN the email login form should be displayed
    expect(LoginWithEmailForm).toHaveBeenCalled();

    // THEN the invite code login form should be displayed
    expect(LoginWithInviteCodeForm).toHaveBeenCalled();
  });

  test("it should handle email login correctly", async () => {
    // GIVEN a user with valid credentials
    const givenUser: TabiyaUser = { id: "0001", email: "foo@bar.baz", name: "Foo Bar" };

    // AND the email login mock will succeed
    loginWithEmailMock.mockImplementation((email, password, onSuccess) => {
      onSuccess(givenUser);
    });

    render(
      <HashRouter>
        <EmailAuthContext.Provider value={emailAuthContextValue}>
          <AnonymousAuthContext.Provider value={anonymousAuthContextValue}>
            <InvitationsContext.Provider value={invitationsContextValue}>
              <Login postLoginHandler={jest.fn()} isLoading={false} />
            </InvitationsContext.Provider>
          </AnonymousAuthContext.Provider>
        </EmailAuthContext.Provider>
      </HashRouter>
    );

    // WHEN the user fills in their email and password
    await act(() => {
      (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnEmailChanged("foo@bar.baz");
      (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnPasswordChanged("Pa$$word123");
    });

    // AND clicks the login button
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // THEN the loginWithEmail function should be called with the correct arguments
    await waitFor(() => {
      expect(loginWithEmailMock).toHaveBeenCalledWith(
        "foo@bar.baz",
        "Pa$$word123",
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  test("it should handle invitation code login correctly", async () => {
    // GIVEN a valid invitation code
    const givenUser: TabiyaUser = { id: "0001", email: "foo@bar.baz", name: "Foo Bar" };

    // AND the invitation code mock will succeed
    checkInvitationStatusMock.mockImplementation((code, onSuccess) => {
      onSuccess(givenUser);
    });

    render(
      <HashRouter>
        <EmailAuthContext.Provider value={emailAuthContextValue}>
          <AnonymousAuthContext.Provider value={anonymousAuthContextValue}>
            <InvitationsContext.Provider value={invitationsContextValue}>
              <Login postLoginHandler={jest.fn()} isLoading={false} />
            </InvitationsContext.Provider>
          </AnonymousAuthContext.Provider>
        </EmailAuthContext.Provider>
      </HashRouter>
    );

    // WHEN the user fills in their invitation code
    await act(() => {
      (LoginWithInviteCodeForm as jest.Mock).mock.calls[0][0].notifyOnInviteCodeChanged("INVITE-CODE-123");
    });

    // AND clicks the login button
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // THEN the checkInvitationStatus function should be called with the correct arguments
    await waitFor(() => {
      expect(checkInvitationStatusMock).toHaveBeenCalledWith(
        "INVITE-CODE-123",
        expect.any(Function),
        expect.any(Function)
      );
    });
  });
});
