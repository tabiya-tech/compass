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
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import authStateService from "src/auth/services/AuthenticationState.service";
import { INVITATIONS_PARAM_NAME, TabiyaUser } from "src/auth/auth.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import * as AuthenticationServiceFactoryModule from "src/auth/services/Authentication.service.factory";
import { DATA_TEST_ID as BUG_REPORT_DATA_TEST_ID } from "src/feedback/bugReport/bugReportButton/BugReportButton";
import * as Sentry from "@sentry/react";
import { DATA_TEST_ID as REQUEST_INVITATION_CODE_DATA_TEST_ID } from "src/auth/components/requestInvitationCode/RequestInvitationCode";
import * as ReactRouterDomModule from "react-router-dom";
import * as EnvServiceModule from "src/envService"
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

  test("should handle application registration code", async () => {
    // GIVEN the application registration code is set
    const givenApplicationRegistrationCode = "app-reg-code";
    jest.spyOn(EnvServiceModule, "getApplicationRegistrationCode").mockReturnValue(givenApplicationRegistrationCode)

    // AND no application login code
    jest.spyOn(EnvServiceModule, "getApplicationLoginCode").mockReturnValue("")

    // AND there is no registration code in the url
    const mockLocation = {
      pathname: "/register",
      search: ``,
    };
    // @ts-ignore
    jest.spyOn(ReactRouterDomModule, "useLocation").mockReturnValue(mockLocation);

    // AND some user credentials.
    const givenPassword = "password";
    const givenEmail = "email"

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
    expect((SocialAuth as unknown as jest.Mock)).toHaveBeenCalledWith({
      disabled: false,
      isLoading: false,
      label: "Sign up with Google",
      notifyOnLoading: expect.any(Function),
      postLoginHandler: expect.any(Function),
      registrationCode: givenApplicationRegistrationCode,
    }, {})

    // AND the register form should match snapshot
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_CONTAINER)).toMatchSnapshot();

    // AND WHEN the register form is submitted
    await act(async () => {
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
      await calls[calls.length - 1][0].notifyOnRegister(givenEmail, givenPassword);
    });


    // THEN expect the register function to have been called with the correct arguments
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenEmail, givenApplicationRegistrationCode);
    });
  })

  test("should prefer the url registration code over the application default registration code", async () => {
    // GIVEN a default application code
    const givenDefaultApplicationCode = "given-application-default-registration-code"
    jest.spyOn(EnvServiceModule, "getApplicationRegistrationCode").mockReturnValue(givenDefaultApplicationCode)

    // AND an invite code is in the url param
    const givenURLParamRegistrationCode = "given-url-registration-code"
    const mockLocation = {
      pathname: "/register",
      search: `?${INVITATIONS_PARAM_NAME}=${givenURLParamRegistrationCode}`,
    };
    // @ts-ignore
    jest.spyOn(ReactRouterDomModule, "useLocation").mockReturnValue(mockLocation);

    // WHEN the user registers the account.
    const givenPassword = "password";
    const givenEmail = "email"

    // AND the register function returns a token
    const registerMock = jest.fn().mockResolvedValue("foo-bar-token");
    jest.spyOn(FirebaseEmailAuthenticationService, "getInstance")
      .mockReturnValue({ register: registerMock} as unknown as FirebaseEmailAuthenticationService);

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
  })
});
