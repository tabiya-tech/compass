import "src/_test_utilities/consoleMock";
import React from "react";
import { render, waitFor, screen, userEvent } from "src/_test_utilities/test-utils";
import SocialAuth, { DATA_TEST_ID } from "./SocialAuth";
import { DATA_TEST_ID as INVITATION_CODE_FORM_DATA_TEST_ID } from "src/auth/components/registrationCodeFormModal/RegistrationCodeFormModal";
import { routerPaths } from "src/app/routerPaths";
import { mockBrowserIsOnLine, unmockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import FirebaseSocialAuthenticationService from "src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service";
import authStateService from "src/auth/services/AuthenticationState.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import {
  SensitivePersonalDataRequirement,
  Language,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { TabiyaUser } from "src/auth/auth.types";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import * as EnvServiceModule from "src/envService";

// Mock the envService module
import "src/_test_utilities/envServiceMock";

// Mock the snackbar provider
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

// Mock the router
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

describe("SocialAuth tests", () => {
  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    unmockBrowserIsOnLine();
  });

  test("should render the SocialAuth component", () => {
    // GIVEN a SocialAuth component
    const givenNotifyOnLogin = jest.fn();
    const givenNotifyOnLoading = jest.fn();
    const givenIsLoading = false;
    // WHEN the component is rendered
    render(
      <SocialAuth
        postLoginHandler={givenNotifyOnLogin}
        isLoading={givenIsLoading}
        notifyOnLoading={givenNotifyOnLoading}
      />
    );

    // THEN expect the component to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON)).toBeInTheDocument();
    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test.each([
    ["accepted", new Date(), routerPaths.ROOT],
    ["not accepted", undefined, routerPaths.CONSENT],
  ])(
    "it should handle successful sign-in for a user who has %s terms and conditions",
    async (_description: string, tc: Date | undefined, _expectedPath: string) => {
      // GIVEN a SocialAuth component
      const givenNotifyOnLogin = jest.fn();
      const givenIsLoading = false;
      const givenToken = "mock-token";
      const givenUser = {
        id: "mock-id",
        name: "foo bar",
        email: "foo@bar.baz",
      };
      const givenNotifyOnLoading = jest.fn();
      // AND the sign-in is successful
      const loginWithGoogleMock = jest.fn().mockResolvedValue(givenToken);
      const getFirebaseSocialAuthInstanceSpy = jest.spyOn(FirebaseSocialAuthenticationService, "getInstance");
      getFirebaseSocialAuthInstanceSpy.mockReturnValue({
        loginWithGoogle: loginWithGoogleMock,
      } as unknown as FirebaseSocialAuthenticationService);

      // AND the AuthProvider updates the user successfully
      jest.spyOn(authStateService.getInstance(), "setUser").mockImplementation((_user: TabiyaUser | null) => {
        return givenUser;
      });
      // AND the user preferences exist for the user
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: givenUser.id,
        language: Language.en,
        sessions: [1],
        user_feedback_answered_questions: {},
        accepted_tc: tc,
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        experiments: {},
      });

      // WHEN the component is rendered
      render(
        <SocialAuth
          postLoginHandler={givenNotifyOnLogin}
          isLoading={givenIsLoading}
          notifyOnLoading={givenNotifyOnLoading}
        />
      );
      // AND the login button is clicked
      const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
      await userEvent.click(loginButton);

      // THEN expect the user to be redirected to the correct path
      await waitFor(() => {
        expect(givenNotifyOnLogin).toHaveBeenCalled();
      });
      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    }
  );

  test("should handle sign-in failure", async () => {
    // GIVEN a SocialAuth component
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoading = false;
    const givenNotifyOnLoading = jest.fn();
    // WHEN the sign-in fails
    const loginWithGoogleMock = jest.fn().mockImplementation((_elementId: string, config: any) => {
      config.callbacks.signInFailure(new Error("Sign-in failed"));
    });
    const getFirebaseSocialAuthInstanceSpy = jest.spyOn(FirebaseSocialAuthenticationService, "getInstance");
    getFirebaseSocialAuthInstanceSpy.mockReturnValue({
      loginWithGoogle: loginWithGoogleMock,
    } as unknown as FirebaseSocialAuthenticationService);

    render(
      <SocialAuth
        postLoginHandler={givenNotifyOnLogin}
        isLoading={givenIsLoading}
        notifyOnLoading={givenNotifyOnLoading}
      />
    );
    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should show message if browser is not online", () => {
    // GIVEN a SocialAuth component
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoading = false;
    const givenNotifyOnLoading = jest.fn();
    // AND the browser is not online
    mockBrowserIsOnLine(false);
    // WHEN the component is rendered
    render(
      <SocialAuth
        postLoginHandler={givenNotifyOnLogin}
        isLoading={givenIsLoading}
        notifyOnLoading={givenNotifyOnLoading}
      />
    );

    // THEN expect the message text to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FIREBASE_FALLBACK_TEXT)).toBeInTheDocument();
    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should call notifyOnLoading with true when login button is clicked", async () => {
    // GIVEN a SocialAuth component
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoading = false;
    const givenNotifyOnLoading = jest.fn();
    const logoutMock = jest.fn();

    // AND the logout function is mocked to succeed
    const getFirebaseSocialAuthInstanceSpy = jest.spyOn(FirebaseSocialAuthenticationService, "getInstance");
    getFirebaseSocialAuthInstanceSpy.mockReturnValue({
      logout: logoutMock,
      loginWithGoogle: jest.fn(),
    } as unknown as FirebaseSocialAuthenticationService);
    // WHEN the component is rendered
    render(
      <SocialAuth
        postLoginHandler={givenNotifyOnLogin}
        isLoading={givenIsLoading}
        notifyOnLoading={givenNotifyOnLoading}
      />
    );

    // AND the login button is clicked
    const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
    await userEvent.click(loginButton);

    // THEN expect notifyOnLoading to have been called with true
    expect(givenNotifyOnLoading).toHaveBeenCalledWith(true);
    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("it should prompt user with registration code form when account doesn't exist", async () => {
    const loginWithGoogleSpy = jest
      .spyOn(FirebaseSocialAuthenticationService.getInstance(), "loginWithGoogle")
      .mockResolvedValue("");

    // GIVEN registration is enabled
    jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("false");

    // AND a SocialAuth component is rendered
    render(<SocialAuth postLoginHandler={jest.fn()} isLoading={false} notifyOnLoading={jest.fn()} />);

    // AND UserPreferences is null
    jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(null);

    // WHEN the user clicks on the login button.
    const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
    await userEvent.click(loginButton);

    // THEN expect the loginWithGoogle function to be called
    expect(loginWithGoogleSpy).toHaveBeenCalled();

    // AND the the registration code prompt is open
    expect(screen.getByTestId(INVITATION_CODE_FORM_DATA_TEST_ID.CONTAINER)).toBeVisible();
  });

  test("should not show registration code form when registration is disabled", async () => {
    const loginWithGoogleSpy = jest
      .spyOn(FirebaseSocialAuthenticationService.getInstance(), "loginWithGoogle")
      .mockResolvedValue("");

    // GIVEN registration is disabled
    jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("true");

    // AND a SocialAuth component is rendered
    render(<SocialAuth postLoginHandler={jest.fn()} isLoading={false} notifyOnLoading={jest.fn()} />);

    // AND UserPreferences is null
    jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(null);

    // WHEN the user clicks on the login button.
    const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
    await userEvent.click(loginButton);

    // THEN expect the loginWithGoogle function to be called
    expect(loginWithGoogleSpy).toHaveBeenCalled();

    // AND expect a message to be displayed indicating that registration is disabled
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
      "This account isn’t registered. Please contact the provider of this link.",
      { variant: "error" }
    );
  });

  describe("Error handling", () => {
    test("should handle RestAPIError in handleError method", async () => {
      // GIVEN a RestAPIError will be thrown during user preference creation
      const { RestAPIError } = await import("src/error/restAPIError/RestAPIError");
      const givenRestAPIError = new RestAPIError(
        "UserPreferencesService",
        "createUserPreferences",
        "POST",
        "/api/preferences",
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to create preferences"
      );

      jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "loginWithGoogle").mockResolvedValue("mock-token");

      const logoutSpy = jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "logout").mockResolvedValue();

      // AND UserPreferences is null (user not registered)
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(null);

      // AND authStateService returns a user
      const givenUser = {
        id: "mock-id",
        name: "foo bar",
        email: "foo@bar.baz",
      };
      jest.spyOn(authStateService.getInstance(), "getUser").mockReturnValue(givenUser);

      // AND createUserPreferences throws RestAPIError
      const UserPreferencesService =
        require("src/userPreferences/UserPreferencesService/userPreferences.service").default;
      jest.spyOn(UserPreferencesService.getInstance(), "createUserPreferences").mockRejectedValue(givenRestAPIError);

      // AND invitationsService returns valid status
      const invitationsService = require("src/auth/services/invitationsService/invitations.service").invitationsService;
      jest.spyOn(invitationsService, "checkInvitationCodeStatus").mockResolvedValue({
        invitation_code: "test-code",
        status: require("src/auth/services/invitationsService/invitations.types").InvitationStatus.VALID,
        invitation_type: require("src/auth/services/invitationsService/invitations.types").InvitationType.REGISTER,
      });

      // AND registration is enabled
      jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("false");

      // WHEN the component is rendered with a registration code
      render(
        <SocialAuth
          postLoginHandler={jest.fn()}
          isLoading={false}
          notifyOnLoading={jest.fn()}
          registrationCode="test-code"
        />
      );

      // AND the user clicks on the login button
      const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
      await userEvent.click(loginButton);

      // THEN expect logout to be called (covers line 68)
      await waitFor(() => {
        expect(logoutSpy).toHaveBeenCalled();
      });

      // AND the error should be logged (covers lines 74-75, 82)
      expect(console.error).toHaveBeenCalledWith(givenRestAPIError);

      // AND a user-friendly error message should be shown (covers line 83)
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining("Failed to login:"), {
        variant: "error",
      });
    });

    test("should handle FirebaseError in handleError method", async () => {
      // GIVEN a FirebaseError will be thrown
      const { FirebaseError } = await import("src/error/FirebaseError/firebaseError");
      const { FirebaseErrorCodes } = await import("src/error/FirebaseError/firebaseError.constants");
      const givenFirebaseError = new FirebaseError(
        "FirebaseSocialAuthenticationService",
        "loginWithGoogle",
        FirebaseErrorCodes.POPUP_CLOSED_BY_USER,
        "Popup closed by user"
      );

      jest
        .spyOn(FirebaseSocialAuthenticationService.getInstance(), "loginWithGoogle")
        .mockRejectedValue(givenFirebaseError);

      const logoutSpy = jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "logout").mockResolvedValue();

      // AND registration is enabled
      jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("false");

      // WHEN the component is rendered
      render(
        <SocialAuth
          postLoginHandler={jest.fn()}
          isLoading={false}
          notifyOnLoading={jest.fn()}
          registrationCode="test-code"
        />
      );

      // AND the user clicks on the login button
      const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
      await userEvent.click(loginButton);

      // THEN expect logout to be called
      await waitFor(() => {
        expect(logoutSpy).toHaveBeenCalled();
      });

      // AND the error should be logged (covers lines 76-77, 82)
      expect(console.error).toHaveBeenCalledWith(givenFirebaseError);

      // AND a user-friendly error message should be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining("Failed to login:"), {
        variant: "error",
      });
    });

    test("should handle generic Error with error.message in handleError method", async () => {
      // GIVEN a generic Error will be thrown
      const givenError = new Error("Something went wrong");

      jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "loginWithGoogle").mockRejectedValue(givenError);

      const logoutSpy = jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "logout").mockResolvedValue();

      // AND registration is enabled
      jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("false");

      // WHEN the component is rendered
      render(
        <SocialAuth
          postLoginHandler={jest.fn()}
          isLoading={false}
          notifyOnLoading={jest.fn()}
          registrationCode="test-code"
        />
      );

      // AND the user clicks on the login button
      const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
      await userEvent.click(loginButton);

      // THEN expect logout to be called
      await waitFor(() => {
        expect(logoutSpy).toHaveBeenCalled();
      });

      // AND the error should be logged (covers line 82)
      expect(console.error).toHaveBeenCalledWith(givenError);

      // AND the error message should be shown (covers line 79)
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining("Something went wrong"), {
        variant: "error",
      });
    });
  });

  describe("registerUser method", () => {
    test("should throw error when no user is found", async () => {
      // GIVEN authStateService returns null (no user)
      jest.spyOn(authStateService.getInstance(), "getUser").mockReturnValue(null);

      const logoutSpy = jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "logout").mockResolvedValue();

      jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "loginWithGoogle").mockResolvedValue("mock-token");

      // AND UserPreferences is null (user not registered)
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(null);

      // AND registration is enabled
      jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("false");

      // WHEN the component is rendered with a registration code
      render(
        <SocialAuth
          postLoginHandler={jest.fn()}
          isLoading={false}
          notifyOnLoading={jest.fn()}
          registrationCode="test-code"
        />
      );

      // AND the user clicks on the login button
      const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
      await userEvent.click(loginButton);

      // THEN expect logout to be called
      await waitFor(() => {
        expect(logoutSpy).toHaveBeenCalled();
      });

      // AND the error should be logged (covers line 96)
      expect(console.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Something went wrong: No user found",
        })
      );
    });

    test("should throw error when registration code is invalid", async () => {
      // GIVEN authStateService returns a user
      const givenUser = {
        id: "mock-id",
        name: "foo bar",
        email: "foo@bar.baz",
      };
      jest.spyOn(authStateService.getInstance(), "getUser").mockReturnValue(givenUser);

      // AND invitationsService returns INVALID status
      const invitationsService = require("src/auth/services/invitationsService/invitations.service").invitationsService;
      const InvitationStatus = require("src/auth/services/invitationsService/invitations.types").InvitationStatus;
      const InvitationType = require("src/auth/services/invitationsService/invitations.types").InvitationType;
      jest.spyOn(invitationsService, "checkInvitationCodeStatus").mockResolvedValue({
        invitation_code: "invalid-code",
        status: InvitationStatus.INVALID,
        invitation_type: InvitationType.REGISTER,
      });

      const logoutSpy = jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "logout").mockResolvedValue();

      jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "loginWithGoogle").mockResolvedValue("mock-token");

      // AND UserPreferences is null (user not registered)
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(null);

      // AND registration is enabled
      jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("false");

      // WHEN the component is rendered with an invalid registration code
      render(
        <SocialAuth
          postLoginHandler={jest.fn()}
          isLoading={false}
          notifyOnLoading={jest.fn()}
          registrationCode="invalid-code"
        />
      );

      // AND the user clicks on the login button
      const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
      await userEvent.click(loginButton);

      // THEN expect logout to be called
      await waitFor(() => {
        expect(logoutSpy).toHaveBeenCalled();
      });

      // AND the error should be logged (covers line 107)
      expect(console.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "The registration code is invalid",
        })
      );
    });

    test("should throw error when invitation type is wrong", async () => {
      // GIVEN authStateService returns a user
      const givenUser = {
        id: "mock-id",
        name: "foo bar",
        email: "foo@bar.baz",
      };
      jest.spyOn(authStateService.getInstance(), "getUser").mockReturnValue(givenUser);

      // AND invitationsService returns LOGIN type (wrong type)
      const invitationsService = require("src/auth/services/invitationsService/invitations.service").invitationsService;
      const InvitationStatus = require("src/auth/services/invitationsService/invitations.types").InvitationStatus;
      const InvitationType = require("src/auth/services/invitationsService/invitations.types").InvitationType;
      jest.spyOn(invitationsService, "checkInvitationCodeStatus").mockResolvedValue({
        invitation_code: "login-code",
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.LOGIN, // Wrong type!
      });

      const logoutSpy = jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "logout").mockResolvedValue();

      jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "loginWithGoogle").mockResolvedValue("mock-token");

      // AND UserPreferences is null (user not registered)
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(null);

      // AND registration is enabled
      jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("false");

      // WHEN the component is rendered with a code of wrong type
      render(
        <SocialAuth
          postLoginHandler={jest.fn()}
          isLoading={false}
          notifyOnLoading={jest.fn()}
          registrationCode="login-code"
        />
      );

      // AND the user clicks on the login button
      const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
      await userEvent.click(loginButton);

      // THEN expect logout to be called
      await waitFor(() => {
        expect(logoutSpy).toHaveBeenCalled();
      });

      // AND the error should be logged (covers line 110)
      expect(console.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "The invitation code is not for registration",
        })
      );
    });

    test("should create user preferences with invitation_code when valid code is provided", async () => {
      // GIVEN authStateService returns a user
      const givenUser = {
        id: "mock-id",
        name: "foo bar",
        email: "foo@bar.baz",
      };
      jest.spyOn(authStateService.getInstance(), "getUser").mockReturnValue(givenUser);

      // AND invitationsService returns VALID status
      const invitationsService = require("src/auth/services/invitationsService/invitations.service").invitationsService;
      const InvitationStatus = require("src/auth/services/invitationsService/invitations.types").InvitationStatus;
      const InvitationType = require("src/auth/services/invitationsService/invitations.types").InvitationType;
      jest.spyOn(invitationsService, "checkInvitationCodeStatus").mockResolvedValue({
        invitation_code: "valid-code",
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.REGISTER,
      });

      // AND UserPreferencesService.createUserPreferences is mocked
      const UserPreferencesService =
        require("src/userPreferences/UserPreferencesService/userPreferences.service").default;
      const createUserPreferencesSpy = jest.spyOn(UserPreferencesService.getInstance(), "createUserPreferences");
      const mockPreferences = {
        user_id: givenUser.id,
        language: Language.en,
        invitation_code: "valid-code",
        sessions: [],
        user_feedback_answered_questions: {},
        accepted_tc: undefined,
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        experiments: {},
      };
      createUserPreferencesSpy.mockResolvedValue(mockPreferences);

      // AND setUserPreferences is mocked
      const setUserPreferencesSpy = jest.spyOn(UserPreferencesStateService.getInstance(), "setUserPreferences");

      jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "loginWithGoogle").mockResolvedValue("mock-token");

      // AND UserPreferences is null (user not registered)
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(null);

      // AND registration is enabled
      jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("false");

      const givenPostLoginHandler = jest.fn();

      // WHEN the component is rendered with a valid registration code
      render(
        <SocialAuth
          postLoginHandler={givenPostLoginHandler}
          isLoading={false}
          notifyOnLoading={jest.fn()}
          registrationCode="valid-code"
        />
      );

      // AND the user clicks on the login button
      const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
      await userEvent.click(loginButton);

      // THEN createUserPreferences should be called with invitation_code
      await waitFor(() => {
        expect(createUserPreferencesSpy).toHaveBeenCalledWith({
          user_id: givenUser.id,
          invitation_code: "valid-code",
          language: Language.en,
        });
      });

      // AND setUserPreferences should be called (covers line 122)
      expect(setUserPreferencesSpy).toHaveBeenCalledWith(mockPreferences);

      // AND postLoginHandler should be called
      expect(givenPostLoginHandler).toHaveBeenCalled();
    });
  });

  describe("handleRegistrationCodeSuccess method", () => {
    test("should handle registration code submission from modal", async () => {
      // GIVEN authStateService returns a user
      const givenUser = {
        id: "mock-id",
        name: "foo bar",
        email: "foo@bar.baz",
      };
      jest.spyOn(authStateService.getInstance(), "getUser").mockReturnValue(givenUser);

      // AND invitationsService returns VALID status
      const invitationsService = require("src/auth/services/invitationsService/invitations.service").invitationsService;
      const InvitationStatus = require("src/auth/services/invitationsService/invitations.types").InvitationStatus;
      const InvitationType = require("src/auth/services/invitationsService/invitations.types").InvitationType;
      jest.spyOn(invitationsService, "checkInvitationCodeStatus").mockResolvedValue({
        invitation_code: "modal-code",
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.REGISTER,
      });

      // AND UserPreferencesService.createUserPreferences is mocked
      const UserPreferencesService =
        require("src/userPreferences/UserPreferencesService/userPreferences.service").default;
      const mockPreferences = {
        user_id: givenUser.id,
        language: Language.en,
        invitation_code: "modal-code",
        sessions: [],
        user_feedback_answered_questions: {},
        accepted_tc: undefined,
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        experiments: {},
      };
      jest.spyOn(UserPreferencesService.getInstance(), "createUserPreferences").mockResolvedValue(mockPreferences);

      // AND setUserPreferences is mocked
      jest.spyOn(UserPreferencesStateService.getInstance(), "setUserPreferences");

      jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "loginWithGoogle").mockResolvedValue("mock-token");

      // AND UserPreferences is null (user not registered)
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(null);

      // AND registration is enabled
      jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("false");

      const givenPostLoginHandler = jest.fn();

      // WHEN the component is rendered without a registration code
      render(<SocialAuth postLoginHandler={givenPostLoginHandler} isLoading={false} notifyOnLoading={jest.fn()} />);

      // AND the user clicks on the login button
      const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
      await userEvent.click(loginButton);

      // AND the modal is shown
      await waitFor(() => {
        expect(screen.getByTestId(INVITATION_CODE_FORM_DATA_TEST_ID.CONTAINER)).toBeVisible();
      });

      // AND the user enters a registration code and submits
      const inputField = screen.getByTestId(INVITATION_CODE_FORM_DATA_TEST_ID.INVITATION_CODE_INPUT);
      await userEvent.type(inputField, "modal-code");

      const submitButton = screen.getByTestId(INVITATION_CODE_FORM_DATA_TEST_ID.SUBMIT_BUTTON);
      await userEvent.click(submitButton);

      // THEN the postLoginHandler should be called (covers lines 167-171)
      await waitFor(() => {
        expect(givenPostLoginHandler).toHaveBeenCalled();
      });

      // AND the modal should be hidden
      await waitFor(() => {
        expect(screen.queryByTestId(INVITATION_CODE_FORM_DATA_TEST_ID.CONTAINER)).not.toBeInTheDocument();
      });
    });
  });

  describe("Modal callbacks", () => {
    test("should handle modal close callback", async () => {
      // GIVEN loginWithGoogle succeeds
      jest.spyOn(FirebaseSocialAuthenticationService.getInstance(), "loginWithGoogle").mockResolvedValue("mock-token");

      // AND UserPreferences is null (user not registered)
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(null);

      // AND registration is enabled
      jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("false");

      // WHEN the component is rendered without a registration code
      render(<SocialAuth postLoginHandler={jest.fn()} isLoading={false} notifyOnLoading={jest.fn()} />);

      // AND the user clicks on the login button
      const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
      await userEvent.click(loginButton);

      // AND the modal is shown
      await waitFor(() => {
        expect(screen.getByTestId(INVITATION_CODE_FORM_DATA_TEST_ID.CONTAINER)).toBeVisible();
      });

      // AND the user closes the modal
      const closeButton = screen.getByTestId(INVITATION_CODE_FORM_DATA_TEST_ID.CLOSE_ICON);
      await userEvent.click(closeButton);

      // THEN the modal should be hidden (covers line 239)
      await waitFor(() => {
        expect(screen.queryByTestId(INVITATION_CODE_FORM_DATA_TEST_ID.CONTAINER)).not.toBeInTheDocument();
      });
    });
  });
});
