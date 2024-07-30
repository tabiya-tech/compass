import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor } from "src/_test_utilities/test-utils";
import { HashRouter, useNavigate } from "react-router-dom";
import Login, { DATA_TEST_ID } from "./Login";
import { AuthContext, TabiyaUser } from "src/auth/AuthProvider/AuthProvider";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { routerPaths } from "src/app/routerPaths";
import { mockUseTokens } from "src/_test_utilities/mockUseTokens";
import { ServiceError } from "src/error/error";
import ErrorConstants from "src/error/error.constants";
import { StatusCodes } from "http-status-codes";
import LoginWithEmailForm from "src/auth/pages/Login/components/LoginWithEmailForm/LoginWithEmailForm";
import { DATA_TEST_ID as AUTH_HEADER_DATA_TEST_ID } from "src/auth/components/AuthHeader/AuthHeader";

// Mock the envService module
jest.mock("src/envService", () => ({
  getFirebaseAPIKey: jest.fn(() => "mock-api-key"),
  getFirebaseDomain: jest.fn(() => "mock-auth-domain"),
  getBackendUrl: jest.fn(() => "mock-backend-url"),
}));

//mock the IDPAuth component
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

// mock the router
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

// mock the login form with email component
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

describe("Testing Login With Email component with AuthProvider", () => {
  const loginWithEmailMock = jest.fn();

  const authContextValue = {
    loginWithEmail: loginWithEmailMock,
    isLoggingIn: false,
    isLoggingOut: false,
    isRegistering: false,
    user: null,
    registerWithEmail: jest.fn(),
    logout: jest.fn(),
    handlePageLoad: jest.fn(),
  };

  beforeEach(() => {
    // Clear console mocks and mock functions
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  beforeAll(() => mockUseTokens());

  test("it should show login form successfully", async () => {
    // Render the component within the AuthContext and Router
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Login postLoginHandler={() => {}} isLoading={false} />
        </AuthContext.Provider>
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toBeInTheDocument();

    // AND the header component should be rendered
    expect(screen.getByTestId(AUTH_HEADER_DATA_TEST_ID.AUTH_HEADER_CONTAINER)).toBeInTheDocument();

    // AND the form inputs and button should be displayed
    expect(LoginWithEmailForm).toHaveBeenCalled();

    // AND when the login form calls the notifyOnLogin function when the form is submitted
    (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnLogin(new Event("submit"));

    // THEN expect the login function to have been called
    await waitFor(() => {
      expect(loginWithEmailMock).toHaveBeenCalled();
    });

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toMatchSnapshot();
  });

  test.each([
    ["accepted", new Date(), routerPaths.ROOT],
    ["not accepted", null, routerPaths.DPA],
  ])(
    "it should handle successful login for a user who has %s terms and conditions",
    async (_description: string, tc: Date | null, expectedPath: string) => {
      // GIVEN the login function will succeed
      const givenUser: TabiyaUser = {
        id: "0001",
        email: "foo@bar.baz",
        name: "Foo Bar",
      };
      const givenNotifyOnLogin = jest.fn();
      const givenIsLoading = false;
      loginWithEmailMock.mockImplementation((email, password, onSuccess, onError) => {
        onSuccess(givenUser);
      });

      render(
        <HashRouter>
          <AuthContext.Provider value={authContextValue}>
            <Login postLoginHandler={givenNotifyOnLogin} isLoading={givenIsLoading} />
          </AuthContext.Provider>
        </HashRouter>
      );

      // THEN expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      // AND the component should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toBeInTheDocument();

      // AND the form inputs and button should be displayed
      expect(LoginWithEmailForm).toHaveBeenCalled();

      // AND when the login form calls the notifyOnLogin function when the form is submitted
      (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnLogin(new Event("submit"));

      // THEN expect the login function to have been called
      await waitFor(() => {
        expect(loginWithEmailMock).toHaveBeenCalled();
      });

      // AND the notifyOnLogin function should have been called
      await waitFor(() => {
        expect(givenNotifyOnLogin).toHaveBeenCalledWith(givenUser);
      });
    }
  );

  test("it should show an error message if the user's email is not verified", async () => {
    // GIVEN the login function will fail with an error message
    loginWithEmailMock.mockImplementation((email, password, onSuccess, onError) => {
      const mockServiceError = new ServiceError(
        "AuthService",
        "handleLogin",
        "POST",
        "/signInWithEmailAndPassword",
        StatusCodes.FORBIDDEN,
        ErrorConstants.FirebaseErrorCodes.EMAIL_NOT_VERIFIED,
        "auth/email-not-verified"
      );

      onError(mockServiceError);
    });

    // AND the Login component is rendered within the AuthContext and Router
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Login postLoginHandler={() => {}} isLoading={false} />
        </AuthContext.Provider>
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toBeInTheDocument();

    // AND the form inputs and button should be displayed
    expect(LoginWithEmailForm).toHaveBeenCalled();

    // AND when the login form calls the notifyOnLogin function when the form is submitted
    (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnLogin(new Event("submit"));

    // THEN expect the login function to have been called
    await waitFor(() => {
      expect(loginWithEmailMock).toHaveBeenCalled();
    });

    // AND the error message should be displayed
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        "The email you are using is registered, but you have not yet verified it. Please verify your email to continue.",
        { variant: "error" }
      );
    });

    // AND the user should not be redirected
    expect(useNavigate()).not.toHaveBeenCalled();
  });

  test("it should show error message when login fails", async () => {
    // GIVEN the login function will fail
    loginWithEmailMock.mockImplementation((email, password, onSuccess, onError) => {
      onError(new Error("Login failed"));
    });

    // AND the Login component is rendered within the AuthContext and Router
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Login postLoginHandler={() => {}} isLoading={false} />
        </AuthContext.Provider>
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toBeInTheDocument();

    // AND the form inputs and button should be displayed
    expect(LoginWithEmailForm).toHaveBeenCalled();

    // AND when the login form calls the notifyOnLogin function when the form is submitted
    (LoginWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnLogin(new Event("submit"));

    // THEN expect the login function to have been called
    await waitFor(() => {
      expect(loginWithEmailMock).toHaveBeenCalled();
    });

    // AND the error message should be displayed
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        "An unexpected error occurred. Please try again later.",
        { variant: "error" }
      );
    });
  });
});
