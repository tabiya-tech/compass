import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor, fireEvent } from "src/_test_utilities/test-utils";
import { HashRouter, useNavigate } from "react-router-dom";
import Login, { DATA_TEST_ID } from "./Login";
import { AuthContext, TabiyaUser } from "src/auth/Providers/AuthProvider/AuthProvider";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { routerPaths } from "src/app/routerPaths";
import { mockUseTokens } from "src/_test_utilities/mockUseTokens";
import { ServiceError } from "src/error/error";
import ErrorConstants from "src/error/error.constants";
import ErrorCodes = ErrorConstants.ErrorCodes;
import { StatusCodes } from "http-status-codes";
import { UserPreferencesContext } from "src/auth/Providers/UserPreferencesProvider/UserPreferencesProvider";
import { Language } from "src/auth/services/UserPreferences/userPreferences.types";
import * as Logger from "src/error/logger";

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

describe("Testing Login component with AuthProvider", () => {
  const loginMock = jest.fn();

  const authContextValue = {
    login: loginMock,
    isLoggingIn: false,
    isRegistering: false,
    user: null,
    register: jest.fn(),
    logout: jest.fn(),
    handlePageLoad: jest.fn(),
  };

  const getUserPreferencesMock = jest.fn();

  const userPreferencesContextValue = {
    getUserPreferences: getUserPreferencesMock,
    createUserPreferences: jest.fn(),
    userPreferences: {
      accepted_tc: new Date(),
      user_id: "0001",
      language: Language.en,
      sessions: [],
    },
    isLoading: false,
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
          <UserPreferencesContext.Provider value={userPreferencesContextValue}>
            <Login />
          </UserPreferencesContext.Provider>
        </AuthContext.Provider>
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toBeDefined();

    // AND the form inputs and button should be displayed
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON)).toBeInTheDocument();

    // AND the login button should not be disabled
    expect(screen.queryByTestId(DATA_TEST_ID.LOGIN_BUTTON_CIRCULAR_PROGRESS)).not.toBeInTheDocument();

    // Simulate form input and submission
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: "john.doe@example.com" } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: "password" } });

    // Trigger form submission
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // Expect the login function to have been called
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith(
        "john.doe@example.com",
        "password",
        expect.any(Function),
        expect.any(Function)
      );
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
      loginMock.mockImplementation((email, password, onSuccess, onError) => {
        onSuccess({ id: "0001" });
      });

      // AND the user preferences provider will return the user preferences
      getUserPreferencesMock.mockImplementation((userId, successCallback, failureCallback) => {
        successCallback({ accepted_tc: tc });
      });

      render(
        <HashRouter>
          <AuthContext.Provider value={authContextValue}>
            <UserPreferencesContext.Provider value={userPreferencesContextValue}>
              <Login />
            </UserPreferencesContext.Provider>
          </AuthContext.Provider>
        </HashRouter>
      );

      // THEN expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      // AND the component should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toBeDefined();

      // AND the form inputs and button should be displayed
      expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON)).toBeInTheDocument();

      // Simulate form input and submission
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: "foo@bar.baz" } });
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: "password" } });

      // Trigger form submission
      fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

      // THEN expect the login function to have been called
      await waitFor(() => {
        expect(loginMock).toHaveBeenCalledWith("foo@bar.baz", "password", expect.any(Function), expect.any(Function));
      });

      // AND the user preferences service should have been called
      await waitFor(() => {
        expect(getUserPreferencesMock).toHaveBeenCalledWith(givenUser.id, expect.any(Function), expect.any(Function));
      });
      // AND the user should be redirected to the expected path
      await waitFor(() => {
        expect(useNavigate()).toHaveBeenCalledWith(expectedPath, { replace: true });
      });
    }
  );

  test("it should show an error message if the user's email is not verified", async () => {
    // GIVEN the login function will fail with an error message
    loginMock.mockImplementation((email, password, onSuccess, onError) => {
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
          <UserPreferencesContext.Provider value={userPreferencesContextValue}>
            <Login />
          </UserPreferencesContext.Provider>
        </AuthContext.Provider>
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toBeDefined();

    // AND the form inputs and button should be displayed
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON)).toBeInTheDocument();

    // Simulate form input and submission
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: "foo@bar.baz" } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: "password" } });

    // Trigger form submission
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // THEN expect the login function to have been called
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("foo@bar.baz", "password", expect.any(Function), expect.any(Function));
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

  test("it should show an error message if the user preferences cannot be fetched", async () => {
    // GIVEN the login function will succeed
    const givenUser: TabiyaUser = {
      id: "0001",
      email: "foo@bar.baz",
      name: "Foo Bar",
    };
    loginMock.mockImplementation((email, password, onSuccess, onError) => {
      onSuccess(givenUser);
    });

    // AND the user preferences service will fail
    const givenUserPreferencesError = new ServiceError(
      "ServiceName",
      "ServiceFunction",
      "GET",
      "/api/path",
      StatusCodes.NOT_FOUND,
      ErrorCodes.API_ERROR,
      "Failed to fetch user preferences"
    );
    getUserPreferencesMock.mockImplementation((userId, onSuccess, onError) => {
      onError(givenUserPreferencesError);
    });

    // AND the Login component is rendered within the AuthContext and Router
    jest.spyOn(Logger, "writeServiceErrorToLog");
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <UserPreferencesContext.Provider value={userPreferencesContextValue}>
            <Login />
          </UserPreferencesContext.Provider>
        </AuthContext.Provider>
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toBeDefined();

    // AND the form inputs and button should be displayed
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON)).toBeInTheDocument();

    // Simulate form input and submission
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: "foo@bar.baz" } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: "password" } });

    // Trigger form submission
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // THEN expect the login function to have been called
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("foo@bar.baz", "password", expect.any(Function), expect.any(Function));
    });

    // AND the user preferences service should have been called
    await waitFor(() => {
      expect(getUserPreferencesMock).toHaveBeenCalledWith(givenUser.id, expect.any(Function), expect.any(Function));
    });

    // AND the error message should be displayed
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        "The requested resource was not found. Please clear your browser's cache and refresh the page.",
        {
          variant: "error",
        }
      );
    });

    // AND the error should be logged
    expect(Logger.writeServiceErrorToLog).toHaveBeenCalledWith(givenUserPreferencesError, console.error);

    // AND the user should not be redirected
    expect(useNavigate()).not.toHaveBeenCalled();
  });

  test("it should show error message when login fails", async () => {
    // GIVEN the login function will fail
    loginMock.mockImplementation((email, password, onSuccess, onError) => {
      onError(new Error("Login failed"));
    });

    // AND the Login component is rendered within the AuthContext and Router
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Login />
        </AuthContext.Provider>
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toBeDefined();

    // AND the form inputs and button should be displayed
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON)).toBeInTheDocument();

    // Simulate form input and submission
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: "foo@bar.baz" } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: "password" } });

    // Trigger form submission
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // THEN expect the login function to have been called
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("foo@bar.baz", "password", expect.any(Function), expect.any(Function));
    });

    // AND the error message should be displayed
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        "An unexpected error occurred. Please try again later.",
        { variant: "error" }
      );
    });
  });

  it("should disable everything when logging in", () => {
    // GIVEN the isLoggingIn flag is set to true
    const _authContextValue = {
      ...authContextValue,
      isLoggingIn: true,
    };

    // WHEN the Login component is rendered within the AuthContext and Router
    render(
      <HashRouter>
        <AuthContext.Provider value={_authContextValue}>
          <Login />
        </AuthContext.Provider>
      </HashRouter>
    );

    // THEN expect the login button to be disabled
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON)).toBeDisabled();
    // AND the email input to be disabled
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeDisabled();
    // AND the password input to be disabled
    expect(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT)).toBeDisabled();

    // AND login button circular progress to be displayed
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON_CIRCULAR_PROGRESS)).toBeInTheDocument();
  });
});
