import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor, fireEvent, act } from "src/_test_utilities/test-utils";
import { HashRouter } from "react-router-dom";
import Login, { DATA_TEST_ID } from "./Login";
import { InvitationsContext } from "src/invitations/InvitationsProvider/InvitationsProvider";
import LoginWithEmailForm from "src/auth/pages/Login/components/LoginWithEmailForm/LoginWithEmailForm";
import LoginWithInviteCodeForm from "./components/LoginWithInviteCodeForm/LoginWithInviteCodeForm";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import { AuthContext, AuthContextValue, TabiyaUser } from "src/auth/AuthProvider";
import { EmailAuthService } from "src/auth/services/emailAuth/EmailAuth.service";
import { AnonymousAuthService } from "src/auth/services/anonymousAuth/AnonymousAuth.service";

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
  const checkInvitationStatusMock = jest.fn();
  let emailAuthService: EmailAuthService;
  let anonymousAuthService: AnonymousAuthService;

  beforeEach(() => {
    emailAuthService = EmailAuthService.getInstance();
    anonymousAuthService = AnonymousAuthService.getInstance();
    jest.useFakeTimers(); // Use Jest's fake timers
    jest.clearAllMocks();
  });

  const authContextValue: AuthContextValue = {
    user: null,
    updateUserByToken: jest.fn(),
    clearUser: jest.fn(),
    isAuthenticationInProgress: false,
    isAuthenticated: false,
  };

  const invitationsContextValue = {
    checkInvitationStatus: checkInvitationStatusMock,
    isInvitationCheckLoading: false,
    invitation: {
      invitation_code: "INVITE-CODE-123",
      status: InvitationStatus.VALID,
      invitation_type: InvitationType.AUTO_REGISTER,
    },
  };

  test("it should show login form successfully", async () => {
    // GIVEN the component is rendered within necessary context providers
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <InvitationsContext.Provider value={invitationsContextValue}>
            <Login postLoginHandler={jest.fn()} isLoading={false} />
          </InvitationsContext.Provider>
        </AuthContext.Provider>
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
    // GIVEN an email and password
    const givenEmail = "foo@bar.baz";
    const givenPassword = "Pa$$word123";

    // AND the email login mock will succeed
    const handleLoginWithEmailSpy = jest
      .spyOn(emailAuthService, "handleLoginWithEmail")
      // @ts-ignore
      .mockImplementation((email, password, onSuccess, onError) => {
        // @ts-ignore
        onSuccess();
      });

    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <InvitationsContext.Provider value={invitationsContextValue}>
            <Login postLoginHandler={jest.fn()} isLoading={false} />
          </InvitationsContext.Provider>
        </AuthContext.Provider>
      </HashRouter>
    );

    // WHEN the user fills in their email and password
    await act(() => {
      (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnEmailChanged(givenEmail);
      (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnPasswordChanged(givenPassword);
    });

    // AND clicks the login button
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // THEN the loginWithEmail function should be called with the correct arguments
    await waitFor(() => {
      expect(handleLoginWithEmailSpy).toHaveBeenCalledWith(
        givenEmail,
        givenPassword,
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
    // AND the anonymous auth mock will succeed
    const handleAnonymousLoginSpy = jest
      .spyOn(anonymousAuthService, "handleAnonymousLogin")
      // @ts-ignore
      .mockImplementation((user, onSuccess, onError) => {
        onSuccess(user);
      });

    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <InvitationsContext.Provider value={invitationsContextValue}>
            <Login postLoginHandler={jest.fn()} isLoading={false} />
          </InvitationsContext.Provider>
        </AuthContext.Provider>
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

    // AND the anonymousAuthService should be called with the correct arguments
    await waitFor(() => {
      expect(handleAnonymousLoginSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
    });
  });
});
