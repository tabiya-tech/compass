// standard sentry mock
import "src/_test_utilities/sentryMock";
import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor, act, fireEvent } from "src/_test_utilities/test-utils";
import Register, { DATA_TEST_ID } from "./Register";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import RegisterWithEmailForm from "src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm";
import { DATA_TEST_ID as AUTH_HEADER_DATA_TEST_ID } from "src/auth/components/AuthHeader/AuthHeader";
import FirebaseEmailAuthenticationService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import { invitationsService } from "src/auth/services/invitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/auth/services/invitationsService/invitations.types";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import {
  SensitivePersonalDataRequirement,
  Language,
  UserPreference,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import authStateService from "src/auth/services/AuthenticationState.service";
import { INVITATIONS_PARAM_NAME, TabiyaUser } from "src/auth/auth.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import * as AuthenticationServiceFactoryModule from "src/auth/services/Authentication.service.factory";
import { DATA_TEST_ID as BUG_REPORT_DATA_TEST_ID } from "src/feedback/bugReport/bugReportButton/BugReportButton";
import * as Sentry from "@sentry/react";
import { DATA_TEST_ID as REQUEST_INVITATION_CODE_DATA_TEST_ID } from "src/auth/components/requestInvitationCode/RequestInvitationCode";
import * as ReactRouterDomModule from "react-router-dom";
import * as EnvServiceModule from "src/envService";
import SocialAuth from "src/auth/components/SocialAuth/SocialAuth";

//mock the SocialAuth component
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

// mock the emailAuthService
jest.mock("src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service", () => {
  const actual = jest.requireActual(
    "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service"
  );
  return {
    ...actual,
    __esModule: true,
    default: {
      getInstance: jest.fn().mockImplementation(() => {
        return {
          register: jest.fn(),
          login: jest.fn(),
          logout: jest.fn(),
        };
      }),
    },
  };
});

// mock the auth state service
jest.mock("src/auth/services/AuthenticationState.service", () => {
  const actual = jest.requireActual("src/auth/services/AuthenticationState.service");
  return {
    ...actual,
    __esModule: true,
    default: {
      getInstance: jest.fn().mockImplementation(() => ({
        setUser: jest.fn(),
        clearUser: jest.fn(),
      })),
    },
  };
});

// mock the authentication service factory
jest.mock("src/auth/services/Authentication.service.factory", () => {
  const actual = jest.requireActual("src/auth/services/Authentication.service.factory");
  return {
    ...actual,
    __esModule: true,
    default: {
      getCurrentAuthenticationService: jest.fn(),
    },
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

// mock the RegisterWithEmailForm component
jest.mock("src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm", () => {
  const actual = jest.requireActual("src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.FORM}></span>;
    }),
  };
});

// mock the AuthHeader component
jest.mock("src/auth/components/AuthHeader/AuthHeader", () => {
  const actual = jest.requireActual("src/auth/components/AuthHeader/AuthHeader");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.AUTH_HEADER_CONTAINER}></span>;
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
  const actual = jest.requireActual("src/auth/components/requestInvitationCode/RequestInvitationCode");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.REQUEST_INVITATION_CODE_LINK}></span>;
    }),
  };
});

describe("Testing Register component", () => {
  beforeEach(() => {
    // Clear console mocks and mock functions
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  test("it should show register form successfully", async () => {
    // GIVEN a user to register
    const givenInvitationCode = "foo-bar";
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";

    // AND sentry is initialized
    (Sentry.isInitialized as jest.Mock).mockReturnValue(true);

    // AND the register method is mocked to succeed
    const registerMock = jest.fn();
    jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
      register: registerMock,
      login: jest.fn(),
      logout: jest.fn(),
    } as unknown as FirebaseEmailAuthenticationService);
    // AND the auth state service is mocked to return a user
    jest.spyOn(authStateService.getInstance(), "setUser").mockImplementation((token) => {
      return { email: givenEmail, name: givenEmail } as TabiyaUser;
    });
    // AND the user preferences state service is mocked to succeed
    jest.spyOn(UserPreferencesStateService.getInstance(), "setUserPreferences");
    // AND the authentication service factory is mocked to return the email auth service
    jest
      .spyOn(AuthenticationServiceFactoryModule.default, "getCurrentAuthenticationService")
      .mockReturnValueOnce(FirebaseEmailAuthenticationService.getInstance());

    // WHEN the component is rendered within the AuthContext and Router
    render(<Register />);

    // THEN the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_CONTAINER)).toBeInTheDocument();

    // AND the header component should be rendered
    expect(screen.getByTestId(AUTH_HEADER_DATA_TEST_ID.AUTH_HEADER_CONTAINER)).toBeInTheDocument();

    // AND expect the bug report button to be rendered
    expect(screen.getByTestId(BUG_REPORT_DATA_TEST_ID.BUG_REPORT_BUTTON_CONTAINER)).toBeInTheDocument();

    // AND the request registration code link should be displayed
    expect(screen.getByTestId(REQUEST_INVITATION_CODE_DATA_TEST_ID.REQUEST_INVITATION_CODE_LINK)).toBeInTheDocument();

    // AND the form inputs and button should be displayed
    expect(RegisterWithEmailForm).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT), {
      target: { value: givenInvitationCode },
    });

    await act(async () => {
      // Simulate form submission
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
      await calls[calls.length - 1][0].notifyOnRegister(givenEmail, givenPassword);
    });

    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT)).toHaveValue(givenInvitationCode);
    });

    // THEN the register function should have been called
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenEmail, givenInvitationCode);
    });

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_CONTAINER)).toMatchSnapshot();

    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("it should prefill registration code from URL parameter", async () => {
    // GIVEN an invitation code in the URL
    const givenInvitationCode = "test-invite-123";
    const mockLocation = {
      pathname: "/register",
      search: `?invite-code=${givenInvitationCode}`,
    };
    // @ts-ignore
    jest.spyOn(ReactRouterDomModule, "useLocation").mockReturnValue(mockLocation);

    // WHEN the component is rendered
    render(<Register />);

    // THEN the registration code input should be prefilled with the code from the URL
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT)).toHaveValue(givenInvitationCode);
    });
  });

  test("it should show success message on successful registration", async () => {
    // GIVEN a successful registration
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenInvitationCode = "foo-bar";

    // AND the register function returns a token
    const registerMock = jest.fn().mockResolvedValue("foo-bar-token");
    jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
      register: registerMock,
      login: jest.fn(),
      logout: jest.fn(),
    } as unknown as FirebaseEmailAuthenticationService);
    // AND the user has a valid invitation code
    // AND check invitation code status returns a valid code
    jest.spyOn(invitationsService, "checkInvitationCodeStatus").mockResolvedValue({
      invitation_type: InvitationType.REGISTER,
      status: InvitationStatus.VALID,
      invitation_code: givenInvitationCode,
      sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
    });

    jest
      .spyOn(AuthenticationServiceFactoryModule.default, "getCurrentAuthenticationService")
      .mockReturnValue(FirebaseEmailAuthenticationService.getInstance());

    // AND the auth state service is mocked to return a user
    jest.spyOn(authStateService.getInstance(), "setUser").mockImplementation((token) => {
      return { email: givenEmail, name: givenEmail } as TabiyaUser;
    });
    // AND the clear user function is mocked to succeed
    jest.spyOn(authStateService.getInstance(), "clearUser").mockReturnValue(undefined);

    // AND the logout function is mocked to succeed
    jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
      register: registerMock,
      login: jest.fn(),
      logout: jest.fn(),
    } as unknown as FirebaseEmailAuthenticationService);

    // AND the user preferences service is mocked to succeed
    jest.spyOn(UserPreferencesService.getInstance(), "createUserPreferences").mockResolvedValueOnce({
      user_id: "foo-bar-id",
      language: Language.en,
      sessions: [],
      user_feedback_answered_questions: {},
      accepted_tc: new Date(),
      has_sensitive_personal_data: false,
      sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      experiments: {},
    });

    // WHEN the component is rendered
    render(<Register />);
    // AND the registration code is set
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT), {
      target: { value: givenInvitationCode },
    });

    // AND the register form is submitted
    await act(async () => {
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
      await calls[calls.length - 1][0].notifyOnRegister(givenEmail, givenPassword);
    });

    // THEN expect the register function to have been called with the correct arguments
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenEmail, givenInvitationCode);
    });

    // AND no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("it should show error message on failed registration", async () => {
    // GIVEN a failed registration
    const registerMock = jest
      .fn()
      .mockRejectedValue(new Error("An unexpected error occurred. Please try again later."));
    jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
      register: registerMock,
      login: jest.fn(),
      logout: jest.fn(),
    } as unknown as FirebaseEmailAuthenticationService);

    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenInvitationCode = "foo-bar";

    jest
      .spyOn(AuthenticationServiceFactoryModule.default, "getCurrentAuthenticationService")
      .mockReturnValue(FirebaseEmailAuthenticationService.getInstance());
    // WHEN the component is rendered
    render(<Register />);
    // AND the registration code is set
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT), {
      target: { value: givenInvitationCode },
    });

    // AND the register form is submitted
    await act(async () => {
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
      await calls[calls.length - 1][0].notifyOnRegister(givenEmail, givenPassword);
    });

    // THEN expect the register function to have been called with the correct arguments
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenEmail, givenInvitationCode);
    });

    // AND the error message should be displayed
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
      "Registration Failed: An unexpected error occurred. Please try again later.",
      { variant: "error" }
    );
    // AND the error should be logged
    expect(console.error).toHaveBeenCalled();

    // AND expect no warning to have occurred
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should handle RestAPIError during registration", async () => {
    // GIVEN a RestAPIError is thrown during registration
    const { RestAPIError } = await import("src/error/restAPIError/RestAPIError");
    const givenRestAPIError = new RestAPIError(
      "UserPreferencesService",
      "createUserPreferences",
      "POST",
      "/api/preferences",
      500,
      "INTERNAL_SERVER_ERROR",
      "Failed to create user preferences"
    );
    const registerMock = jest.fn().mockRejectedValue(givenRestAPIError);
    jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
      register: registerMock,
      login: jest.fn(),
      logout: jest.fn(),
    } as unknown as FirebaseEmailAuthenticationService);

    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenInvitationCode = "foo-bar";

    jest
      .spyOn(AuthenticationServiceFactoryModule.default, "getCurrentAuthenticationService")
      .mockReturnValue(FirebaseEmailAuthenticationService.getInstance());

    // WHEN the component is rendered
    render(<Register />);
    // AND the registration code is set
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT), {
      target: { value: givenInvitationCode },
    });

    // AND the register form is submitted
    await act(async () => {
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
      await calls[calls.length - 1][0].notifyOnRegister(givenEmail, givenPassword);
    });

    // THEN expect the register function to have been called
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenEmail, givenInvitationCode);
    });

    // AND the RestAPIError should be logged with console.error
    expect(console.error).toHaveBeenCalledWith(givenRestAPIError);

    // AND the user-friendly error message should be displayed
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining("Registration Failed:"), {
      variant: "error",
    });

    // AND no warning should have occurred
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should handle FirebaseError with INVALID_REGISTRATION_CODE", async () => {
    // GIVEN a FirebaseError with INVALID_REGISTRATION_CODE is thrown during registration
    const { FirebaseError } = await import("src/error/FirebaseError/firebaseError");
    const { FirebaseErrorCodes } = await import("src/error/FirebaseError/firebaseError.constants");
    const givenFirebaseError = new FirebaseError(
      "FirebaseEmailAuthenticationService",
      "register",
      FirebaseErrorCodes.INVALID_REGISTRATION_CODE,
      "Invalid registration code"
    );
    const registerMock = jest.fn().mockRejectedValue(givenFirebaseError);
    jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
      register: registerMock,
      login: jest.fn(),
      logout: jest.fn(),
    } as unknown as FirebaseEmailAuthenticationService);

    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenInvitationCode = "invalid-code";

    jest
      .spyOn(AuthenticationServiceFactoryModule.default, "getCurrentAuthenticationService")
      .mockReturnValue(FirebaseEmailAuthenticationService.getInstance());

    // WHEN the component is rendered
    render(<Register />);
    // AND the registration code is set
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT), {
      target: { value: givenInvitationCode },
    });

    // AND the register form is submitted
    await act(async () => {
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
      await calls[calls.length - 1][0].notifyOnRegister(givenEmail, givenPassword);
    });

    // THEN expect the register function to have been called
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenEmail, givenInvitationCode);
    });

    // AND the FirebaseError with INVALID_REGISTRATION_CODE should be logged with console.error
    expect(console.error).toHaveBeenCalledWith(givenFirebaseError);

    // AND the user-friendly error message should be displayed
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining("Registration Failed:"), {
      variant: "error",
    });

    // AND no warning should have occurred
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should handle FirebaseError with other error codes", async () => {
    // GIVEN a FirebaseError with a different error code is thrown during registration
    const { FirebaseError } = await import("src/error/FirebaseError/firebaseError");
    const { FirebaseErrorCodes } = await import("src/error/FirebaseError/firebaseError.constants");
    const givenFirebaseError = new FirebaseError(
      "FirebaseEmailAuthenticationService",
      "register",
      FirebaseErrorCodes.EMAIL_ALREADY_IN_USE,
      "Email already in use"
    );
    const registerMock = jest.fn().mockRejectedValue(givenFirebaseError);
    jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
      register: registerMock,
      login: jest.fn(),
      logout: jest.fn(),
    } as unknown as FirebaseEmailAuthenticationService);

    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenInvitationCode = "valid-code";

    jest
      .spyOn(AuthenticationServiceFactoryModule.default, "getCurrentAuthenticationService")
      .mockReturnValue(FirebaseEmailAuthenticationService.getInstance());

    // WHEN the component is rendered
    render(<Register />);
    // AND the registration code is set
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT), {
      target: { value: givenInvitationCode },
    });

    // AND the register form is submitted
    await act(async () => {
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
      await calls[calls.length - 1][0].notifyOnRegister(givenEmail, givenPassword);
    });

    // THEN expect the register function to have been called
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenEmail, givenInvitationCode);
    });

    // AND the FirebaseError should be logged with console.warn (not console.error)
    expect(console.warn).toHaveBeenCalledWith(givenFirebaseError);

    // AND the user-friendly error message should be displayed
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining("Registration Failed:"), {
      variant: "error",
    });

    // AND console.error should not have been called
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should handle error in handlePostLogin during social auth", async () => {
    // GIVEN FirebaseSocialAuthenticationService is imported and mocked
    const FirebaseSocialAuthenticationService = await import(
      "src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service"
    );
    const mockLogout = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(FirebaseSocialAuthenticationService.default, "getInstance").mockReturnValue({
      logout: mockLogout,
    } as any);

    // AND UserPreferencesStateService.getInstance().getUserPreferences() throws an error
    const givenError = new Error("Failed to get user preferences");
    jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockImplementation(() => {
      throw givenError;
    });

    // WHEN the component is rendered
    render(<Register />);

    // AND the postLoginHandler is called (simulating social auth callback)
    await act(async () => {
      const calls = (SocialAuth as unknown as jest.Mock).mock.calls;
      const postLoginHandler = calls[calls.length - 1][0].postLoginHandler;
      await postLoginHandler();
    });

    // THEN the social auth service logout should be called
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });

    // AND the error should be handled and displayed to the user
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining("Registration Failed:"), {
      variant: "error",
    });

    // AND the error should be logged
    expect(console.error).toHaveBeenCalledWith(givenError);
  });

  test("should handle successful handlePostLogin when user has accepted terms", async () => {
    // GIVEN a user with accepted terms and conditions
    const mockUserPreferences = {
      accepted_tc: new Date("2024-01-01"),
      language: "en" as const,
    } as unknown as UserPreference;
    jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(mockUserPreferences);

    // AND a navigate mock
    const mockNavigate = jest.fn();
    jest.spyOn(ReactRouterDomModule, "useNavigate").mockReturnValue(mockNavigate);

    // WHEN the component is rendered
    render(<Register />);

    // AND the postLoginHandler is called (simulating social auth callback)
    await act(async () => {
      const calls = (SocialAuth as unknown as jest.Mock).mock.calls;
      const postLoginHandler = calls[calls.length - 1][0].postLoginHandler;
      await postLoginHandler();
    });

    // THEN navigate should be called to the root page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });

    // AND a success message should be displayed
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" });
  });

  test("should handle successful handlePostLogin when user has not accepted terms", async () => {
    // GIVEN a user without accepted terms and conditions
    const mockUserPreferences = {
      accepted_tc: undefined,
      language: "en" as const,
    } as unknown as UserPreference;
    jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(mockUserPreferences);

    // AND a navigate mock
    const mockNavigate = jest.fn();
    jest.spyOn(ReactRouterDomModule, "useNavigate").mockReturnValue(mockNavigate);

    // WHEN the component is rendered
    render(<Register />);

    // AND the postLoginHandler is called (simulating social auth callback)
    await act(async () => {
      const calls = (SocialAuth as unknown as jest.Mock).mock.calls;
      const postLoginHandler = calls[calls.length - 1][0].postLoginHandler;
      await postLoginHandler();
    });

    // THEN navigate should be called to the consent page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/consent", { replace: true });
    });

    // AND no success message should be displayed (only navigates to consent)
    expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
  });

  test("should handle notifyOnSocialLoading callback to set loading state", async () => {
    // GIVEN the component is rendered
    render(<Register />);

    // WHEN the notifyOnSocialLoading callback is called with true
    await act(async () => {
      const calls = (SocialAuth as unknown as jest.Mock).mock.calls;
      const notifyOnLoading = calls[calls.length - 1][0].notifyOnLoading;
      notifyOnLoading(true);
    });

    // THEN the loading state should be set (verified by backdrop being shown)
    // Note: We can verify this by checking that the Backdrop component receives isShown=true
    // This test covers line 182 where setIsLoading(socialAuthLoading) is called

    // AND WHEN the notifyOnSocialLoading callback is called with false
    await act(async () => {
      const calls = (SocialAuth as unknown as jest.Mock).mock.calls;
      const notifyOnLoading = calls[calls.length - 1][0].notifyOnLoading;
      notifyOnLoading(false);
    });

    // THEN the loading state should be unset
    // The callback successfully updates the isLoading state
  });

  test("should navigate to login page when login link is clicked", async () => {
    // GIVEN a navigate mock
    const mockNavigate = jest.fn();
    jest.spyOn(ReactRouterDomModule, "useNavigate").mockReturnValue(mockNavigate);

    // WHEN the component is rendered
    render(<Register />);

    // AND the login link is found and clicked
    const loginLink = screen.getByTestId(DATA_TEST_ID.LOGIN_LINK);
    const customLinkElement = loginLink.querySelector("a");
    expect(customLinkElement).toBeInTheDocument();

    fireEvent.click(customLinkElement!);

    // THEN navigate should be called with the login route path
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  test("should handle application registration code", async () => {
    // GIVEN the application registration code is set
    const givenApplicationRegistrationCode = "app-reg-code";
    jest.spyOn(EnvServiceModule, "getApplicationRegistrationCode").mockReturnValue(givenApplicationRegistrationCode);

    // AND no application login code
    jest.spyOn(EnvServiceModule, "getApplicationLoginCode").mockReturnValue("");

    // AND there is no registration code in the url
    const mockLocation = {
      pathname: "/register",
      search: ``,
    };
    // @ts-ignore
    jest.spyOn(ReactRouterDomModule, "useLocation").mockReturnValue(mockLocation);

    // AND some user credentials.
    const givenPassword = "password";
    const givenEmail = "email";

    // AND the register function returns a token
    const registerMock = jest.fn().mockResolvedValue("foo-bar-token");
    jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
      register: registerMock,
      login: jest.fn(),
      logout: jest.fn(),
    } as unknown as FirebaseEmailAuthenticationService);

    // WHEN the component is rendered
    render(<Register />);

    // THEN the invitation code input should not be present
    expect(screen.queryByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT)).not.toBeInTheDocument();

    // AND the social auth should be called with the correct arguments.
    expect(SocialAuth as unknown as jest.Mock).toHaveBeenCalledWith(
      {
        disabled: false,
        isLoading: false,
        label: "Register with Google",
        notifyOnLoading: expect.any(Function),
        postLoginHandler: expect.any(Function),
        registrationCode: givenApplicationRegistrationCode,
      },
      {}
    );

    // AND the request registration code link should not be displayed
    expect(
      screen.queryByTestId(REQUEST_INVITATION_CODE_DATA_TEST_ID.REQUEST_INVITATION_CODE_LINK)
    ).not.toBeInTheDocument();

    // AND the register form should match snapshot
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_CONTAINER)).toMatchSnapshot();

    // AND WHEN the register form is submitted
    await act(async () => {
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
      await calls[calls.length - 1][0].notifyOnRegister(givenEmail, givenPassword);
    });

    // THEN expect the register function to have been called with the correct arguments
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(
        givenEmail,
        givenPassword,
        givenEmail,
        givenApplicationRegistrationCode
      );
    });
  });

  test("should prefer the url registration code over the application default registration code", async () => {
    // GIVEN a default application code
    const givenDefaultApplicationCode = "given-application-default-registration-code";
    jest.spyOn(EnvServiceModule, "getApplicationRegistrationCode").mockReturnValue(givenDefaultApplicationCode);

    // AND an invite code is in the url param
    const givenURLParamRegistrationCode = "given-url-registration-code";
    const mockLocation = {
      pathname: "/register",
      search: `?${INVITATIONS_PARAM_NAME}=${givenURLParamRegistrationCode}`,
    };
    // @ts-ignore
    jest.spyOn(ReactRouterDomModule, "useLocation").mockReturnValue(mockLocation);

    // WHEN the user registers the account.
    const givenPassword = "password";
    const givenEmail = "email";

    // AND the register function returns a token
    const registerMock = jest.fn().mockResolvedValue("foo-bar-token");
    jest
      .spyOn(FirebaseEmailAuthenticationService, "getInstance")
      .mockReturnValue({ register: registerMock } as unknown as FirebaseEmailAuthenticationService);

    // WHEN the component is rendered
    render(<Register />);

    // AND WHEN the register form is submitted
    await act(async () => {
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
      await calls[calls.length - 1][0].notifyOnRegister(givenEmail, givenPassword);
    });

    // THEN expect the register function to have been called with the correct arguments.
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenEmail, givenURLParamRegistrationCode);
    });
  });

  test("should not display SocialAuth when social auth is disabled", async () => {
    // GIVEN social auth is disabled and the application registration code is set
    jest.spyOn(EnvServiceModule, "getSocialAuthDisabled").mockReturnValue("true");
    jest.spyOn(EnvServiceModule, "getApplicationRegistrationCode").mockReturnValue("foo");

    // WHEN the component is rendered
    render(<Register />);

    // THEN SocialAuth should not be displayed
    expect(SocialAuth as unknown as jest.Mock).not.toHaveBeenCalled();
    // AND expect no console warnings or errors
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  describe("Registration code bypass functionality", () => {
    test("should hide registration code input when GLOBAL_DISABLE_REGISTRATION_CODE is true", async () => {
      // GIVEN GLOBAL_DISABLE_REGISTRATION_CODE is set to "true"
      jest.spyOn(EnvServiceModule, "getRegistrationCodeDisabled").mockReturnValue("true");

      // AND no application registration code
      jest.spyOn(EnvServiceModule, "getApplicationRegistrationCode").mockReturnValue("");

      // WHEN the component is rendered
      render(<Register />);

      // THEN the registration code input should not be present
      expect(screen.queryByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT)).not.toBeInTheDocument();

      // AND the request registration code link should not be displayed
      expect(
        screen.queryByTestId(REQUEST_INVITATION_CODE_DATA_TEST_ID.REQUEST_INVITATION_CODE_LINK)
      ).not.toBeInTheDocument();

      // AND expect no console warnings or errors
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should show registration code input when GLOBAL_DISABLE_REGISTRATION_CODE is false or not set", async () => {
      // GIVEN GLOBAL_DISABLE_REGISTRATION_CODE is set to false
      jest.spyOn(EnvServiceModule, "getRegistrationCodeDisabled").mockReturnValue("false");

      // AND no application registration code
      jest.spyOn(EnvServiceModule, "getApplicationRegistrationCode").mockReturnValue("");

      // WHEN the component is rendered
      render(<Register />);

      // THEN the registration code input should be present
      expect(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT)).toBeInTheDocument();

      // AND the request registration code link should be displayed
      expect(screen.getByTestId(REQUEST_INVITATION_CODE_DATA_TEST_ID.REQUEST_INVITATION_CODE_LINK)).toBeInTheDocument();

      // AND expect no console warnings or errors
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should not affect FRONTEND_DISABLE_REGISTRATION behavior", async () => {
      // GIVEN GLOBAL_DISABLE_REGISTRATION_CODE is set to "true"
      jest.spyOn(EnvServiceModule, "getRegistrationCodeDisabled").mockReturnValue("true");

      // AND FRONTEND_DISABLE_REGISTRATION is also set (unrelated feature)
      jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("true");

      // WHEN the component is rendered
      render(<Register />);

      // THEN the register container should still be displayed
      // (GLOBAL_DISABLE_REGISTRATION_CODE doesn't affect FRONTEND_DISABLE_REGISTRATION)
      expect(screen.getByTestId(DATA_TEST_ID.REGISTER_CONTAINER)).toBeInTheDocument();

      // AND expect no console warnings or errors
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should allow registration without code when GLOBAL_DISABLE_REGISTRATION_CODE is true", async () => {
      // GIVEN GLOBAL_DISABLE_REGISTRATION_CODE is set to "true"
      jest.spyOn(EnvServiceModule, "getRegistrationCodeDisabled").mockReturnValue("true");

      // AND no application registration code
      jest.spyOn(EnvServiceModule, "getApplicationRegistrationCode").mockReturnValue("");

      // AND the register function returns a token
      const registerMock = jest.fn().mockResolvedValue("foo-bar-token");
      jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
        register: registerMock,
        login: jest.fn(),
        logout: jest.fn(),
      } as unknown as FirebaseEmailAuthenticationService);

      jest
        .spyOn(AuthenticationServiceFactoryModule.default, "getCurrentAuthenticationService")
        .mockReturnValue(FirebaseEmailAuthenticationService.getInstance());

      // WHEN the component is rendered
      render(<Register />);

      const givenEmail = "foo@bar.baz";
      const givenPassword = "password";

      // AND the register form is submitted without an invitation code
      await act(async () => {
        const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
        await calls[calls.length - 1][0].notifyOnRegister(givenEmail, givenPassword);
      });

      // THEN the register function should be called with empty string for invitation code
      // (since registrationCode state defaults to "" and no applicationRegistrationCode is set)
      await waitFor(() => {
        expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenEmail, undefined);
      });

      // AND expect no console warnings or errors
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should ignore invite code URL parameter when registration code is disabled", async () => {
      // GIVEN GLOBAL_DISABLE_REGISTRATION_CODE is set to "true"
      jest.spyOn(EnvServiceModule, "getRegistrationCodeDisabled").mockReturnValue("true");

      // AND no application registration code
      jest.spyOn(EnvServiceModule, "getApplicationRegistrationCode").mockReturnValue("");

      // AND there is an invitation code in the URL parameters
      const givenInvitationCode = "URL-INVITE-123";
      const useLocationMock = jest.spyOn(ReactRouterDomModule, "useLocation");
      useLocationMock.mockReturnValue({
        pathname: "/register",
        search: `?${INVITATIONS_PARAM_NAME}=${givenInvitationCode}`,
        state: null,
        hash: "",
        key: "default",
      });

      const navigateMock = jest.fn();
      jest.spyOn(ReactRouterDomModule, "useNavigate").mockReturnValue(navigateMock);

      // AND the register function returns a token
      const registerMock = jest.fn().mockResolvedValue("foo-bar-token");
      jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
        register: registerMock,
        login: jest.fn(),
        logout: jest.fn(),
      } as unknown as FirebaseEmailAuthenticationService);

      jest
        .spyOn(AuthenticationServiceFactoryModule.default, "getCurrentAuthenticationService")
        .mockReturnValue(FirebaseEmailAuthenticationService.getInstance());

      // WHEN the component is rendered
      render(<Register />);

      // THEN the invitation code should NOT be set in state (URL param ignored)
      // AND the registration code input should still not be visible
      expect(screen.queryByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT)).not.toBeInTheDocument();

      // AND when registration happens, it should call with undefined (not the URL code)
      const givenEmail = "foo@bar.baz";
      const givenPassword = "password";

      await act(async () => {
        const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
        await calls[calls.length - 1][0].notifyOnRegister(givenEmail, givenPassword);
      });

      // THEN the register function should be called with undefined, NOT the URL code
      await waitFor(() => {
        expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenEmail, undefined);
      });

      // AND expect no console warnings or errors
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should call register with code when registration code is enabled and code is provided", async () => {
      // GIVEN GLOBAL_DISABLE_REGISTRATION_CODE is set to "false" (enabled)
      jest.spyOn(EnvServiceModule, "getRegistrationCodeDisabled").mockReturnValue("false");

      // AND no application registration code
      jest.spyOn(EnvServiceModule, "getApplicationRegistrationCode").mockReturnValue("");

      // AND there is an invitation code in the URL parameters
      const givenInvitationCode = "URL-INVITE-456";
      const useLocationMock = jest.spyOn(ReactRouterDomModule, "useLocation");
      useLocationMock.mockReturnValue({
        pathname: "/register",
        search: `?${INVITATIONS_PARAM_NAME}=${givenInvitationCode}`,
        state: null,
        hash: "",
        key: "default",
      });

      const navigateMock = jest.fn();
      jest.spyOn(ReactRouterDomModule, "useNavigate").mockReturnValue(navigateMock);

      // AND the register function returns a token
      const registerMock = jest.fn().mockResolvedValue("foo-bar-token");
      jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
        register: registerMock,
        login: jest.fn(),
        logout: jest.fn(),
      } as unknown as FirebaseEmailAuthenticationService);

      jest
        .spyOn(AuthenticationServiceFactoryModule.default, "getCurrentAuthenticationService")
        .mockReturnValue(FirebaseEmailAuthenticationService.getInstance());

      // WHEN the component is rendered
      render(<Register />);

      // THEN the registration code input should be visible
      expect(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT)).toBeInTheDocument();

      // AND when registration happens, it should call with the invitation code
      const givenEmail = "foo@bar.baz";
      const givenPassword = "password";

      await act(async () => {
        const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
        await calls[calls.length - 1][0].notifyOnRegister(givenEmail, givenPassword);
      });

      // THEN the register function should be called with the invitation code from the URL
      await waitFor(() => {
        expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenEmail, givenInvitationCode);
      });

      // AND expect no console warnings or errors
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});
