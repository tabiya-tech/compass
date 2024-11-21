import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor, act, fireEvent } from "src/_test_utilities/test-utils";
import { HashRouter } from "react-router-dom";
import Register, { DATA_TEST_ID } from "./Register";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import RegisterWithEmailForm from "src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm";
import { DATA_TEST_ID as AUTH_HEADER_DATA_TEST_ID } from "src/auth/components/AuthHeader/AuthHeader";
import FirebaseEmailAuthenticationService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import { invitationsService } from "src/auth/services/invitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/auth/services/invitationsService/invitations.types";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import {
  SensitivePersonalDataRequirement,
  Language,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import authStateService from "src/auth/services/AuthenticationState.service";
import { TabiyaUser } from "src/auth/auth.types";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import * as AuthenticationServiceFactoryModule from "src/auth/services/Authentication.service.factory";

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

// mock the user preferences service
jest.mock("src/userPreferences/UserPreferencesService/userPreferences.service", () => {
  const actual = jest.requireActual("src/userPreferences/UserPreferencesService/userPreferences.service");
  return {
    ...actual,
    __esModule: true,
    userPreferencesService: {
      createUserPreferences: jest.fn(),
      getUserPreferences: jest.fn(),
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
    const givenUserName = "Foo Bar";
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";

    // AND the register method is mocked to succeed
    const registerMock = jest.fn();
    jest.spyOn(FirebaseEmailAuthenticationService, "getInstance").mockReturnValue({
      register: registerMock,
      login: jest.fn(),
      logout: jest.fn(),
    } as unknown as FirebaseEmailAuthenticationService);
    // AND the auth state service is mocked to return a user
    jest.spyOn(authStateService.getInstance(), "setUser").mockImplementation((token) => {
      return { email: givenEmail, name: givenUserName } as TabiyaUser;
    });
    // AND the user preferences state service is mocked to succeed
    jest.spyOn(userPreferencesStateService, "setUserPreferences");
    // AND the authentication service factory is mocked to return the email auth service
    jest
      .spyOn(AuthenticationServiceFactoryModule.default, "getCurrentAuthenticationService")
      .mockReturnValueOnce(FirebaseEmailAuthenticationService.getInstance());
    // WHEN the component is rendered within the AuthContext and Router
    render(
      <HashRouter>
        <Register />
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_CONTAINER)).toBeInTheDocument();

    // AND the header component should be rendered
    expect(screen.getByTestId(AUTH_HEADER_DATA_TEST_ID.AUTH_HEADER_CONTAINER)).toBeInTheDocument();

    // AND the form inputs and button should be displayed
    expect(RegisterWithEmailForm).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT), {
      target: { value: givenInvitationCode },
    });

    await act(async () => {
      // Simulate form submission
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;

      await calls[calls.length - 1][0].notifyOnRegister(givenUserName, givenEmail, givenPassword);
    });

    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT)).toHaveValue(givenInvitationCode);
    });

    // THEN the register function should have been called
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenUserName, givenInvitationCode);
    });

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_CONTAINER)).toMatchSnapshot();
  });

  test("it should show success message on successful registration", async () => {
    // GIVEN a successful registration
    const givenUserName = "Foo Bar";
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
      return { email: givenEmail, name: givenUserName } as TabiyaUser;
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
    jest.spyOn(userPreferencesService, "createUserPreferences").mockResolvedValue({
      user_id: "foo-bar-id",
      language: Language.en,
      sessions: [],
      accepted_tc: new Date(),
      has_sensitive_personal_data: false,
      sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
    });

    // WHEN the component is rendered
    render(
      <HashRouter>
        <Register />
      </HashRouter>
    );
    // AND the registration code is set
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT), {
      target: { value: givenInvitationCode },
    });

    // AND the register form is submitted
    await act(async () => {
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
      await calls[calls.length - 1][0].notifyOnRegister(givenUserName, givenEmail, givenPassword, givenInvitationCode);
    });

    // THEN expect the register function to have been called with the correct arguments
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenUserName, givenInvitationCode);
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

    const givenUserName = "Foo Bar";
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenInvitationCode = "foo-bar";

    jest
      .spyOn(AuthenticationServiceFactoryModule.default, "getCurrentAuthenticationService")
      .mockReturnValue(FirebaseEmailAuthenticationService.getInstance());
    // WHEN the component is rendered
    render(
      <HashRouter>
        <Register />
      </HashRouter>
    );

    // AND the registration code is set
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT), {
      target: { value: givenInvitationCode },
    });

    // AND the register form is submitted
    await act(async () => {
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;
      await calls[calls.length - 1][0].notifyOnRegister(givenUserName, givenEmail, givenPassword, givenInvitationCode);
    });

    // THEN expect the register function to have been called with the correct arguments
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(givenEmail, givenPassword, givenUserName, givenInvitationCode);
    });

    // AND the error message should be displayed
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
      "Registration Failed: An unexpected error occurred. Please try again later.",
      { variant: "error" }
    );
  });
});
