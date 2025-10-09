// standard sentry mock
import "src/_test_utilities/sentryMock";
import "src/_test_utilities/consoleMock";
import "src/_test_utilities/envServiceMock";

import * as Sentry from "@sentry/react";
import { render, screen, waitFor } from "src/_test_utilities/test-utils";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import userEvent from "@testing-library/user-event";
import * as EnvServiceModule from "src/envService";
import Landing, { DATA_TEST_ID } from "src/auth/pages/Landing/Landing";
import FirebaseInvitationCodeAuthenticationService from "src/auth/services/FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import { FirebaseError } from "src/error/FirebaseError/firebaseError";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import {
  FirebaseErrorCodes,
  USER_FRIENDLY_FIREBASE_ERROR_MESSAGES,
} from "src/error/FirebaseError/firebaseError.constants";

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

// mock the snackbar provider
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

describe("Landing Page", () => {
  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
  });

  test("should render landing page successfully", () => {
    // GIVEN sentry is initialized
    (Sentry.isInitialized as jest.Mock).mockReturnValue(true);

    // AND the application login code is set
    const givenApplicationLoginCode = "bar";
    jest.spyOn(EnvServiceModule, "getApplicationLoginCode").mockReturnValue(givenApplicationLoginCode);

    // WHEN the component is rendered
    render(<Landing />);

    // THEN expect the landing dialog to be in the document
    const landingPage = screen.getByTestId(DATA_TEST_ID.LANDING_DIALOG);
    expect(landingPage).toBeInTheDocument();
    // AND the landing dialog content to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.LANDING_DIALOG_CONTENT)).toBeInTheDocument();
    // AND the login button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.LANDING_LOGIN_BUTTON)).toBeInTheDocument();
    // AND the signup button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.LANDING_SIGNUP_BUTTON)).toBeInTheDocument();
    // AND continue as guest button to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.LANDING_GUEST_BUTTON)).toBeInTheDocument();
    // AND the divider to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.LANDING_DIVIDER)).toBeInTheDocument();
    // AND to match the snapshot
    expect(landingPage).toMatchSnapshot();
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should navigate to login page when login button is clicked", async () => {
    // GIVEN the landing page is rendered
    render(<Landing />);

    // WHEN the login button is clicked
    const loginButton = screen.getByTestId(DATA_TEST_ID.LANDING_LOGIN_BUTTON);
    await userEvent.click(loginButton);

    // THEN expect to navigate to the login page
    await waitFor(() => {
      expect(useNavigate()).toHaveBeenCalledWith(routerPaths.LOGIN);
    });
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should navigate to register page when signup button is clicked", async () => {
    // GIVEN the landing page is rendered
    render(<Landing />);

    // WHEN the signup button is clicked
    const signupButton = screen.getByTestId(DATA_TEST_ID.LANDING_SIGNUP_BUTTON);
    await userEvent.click(signupButton);

    // THEN expect to navigate to the register page
    await waitFor(() => {
      expect(useNavigate()).toHaveBeenCalledWith(routerPaths.REGISTER);
    });
    // AND no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe("Continue as Guest button", () => {
    test("should handle successful guest login", async () => {
      // GIVEN the application login code is set
      const givenApplicationLoginCode = "bar";
      jest.spyOn(EnvServiceModule, "getApplicationLoginCode").mockReturnValue(givenApplicationLoginCode);

      // AND the application login code is not disabled
      jest.spyOn(EnvServiceModule, "getLoginCodeDisabled").mockReturnValue("false");

      // AND anonymous login function will succeed
      const anonymousLoginMock = jest.fn().mockResolvedValue("mock-token");
      jest.spyOn(FirebaseInvitationCodeAuthenticationService, "getInstance").mockReturnValue({
        login: anonymousLoginMock,
      } as unknown as FirebaseInvitationCodeAuthenticationService);

      // AND user has accepted terms
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValueOnce({
        accepted_tc: new Date(),
        user_id: "1234",
      } as unknown as UserPreference);

      // AND the component is rendered
      render(<Landing />);

      // WHEN continue as guest button is clicked
      const guestButton = screen.getByTestId(DATA_TEST_ID.LANDING_GUEST_BUTTON);
      await userEvent.click(guestButton);

      // THEN expect a successful login
      expect(anonymousLoginMock).toHaveBeenCalledWith(givenApplicationLoginCode);
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Invitation code is valid", { variant: "success" });

      // AND expect navigation to root page
      await waitFor(() => {
        expect(useNavigate()).toHaveBeenCalledWith(routerPaths.ROOT, { replace: true });
      });

      // AND welcome message
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Welcome!", { variant: "success" });

      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should navigate to consent page when terms and conditions are not accepted", async () => {
      // GIVEN successful login
      jest.spyOn(FirebaseInvitationCodeAuthenticationService, "getInstance").mockReturnValue({
        login: jest.fn().mockResolvedValue("mock-token"),
      } as unknown as FirebaseInvitationCodeAuthenticationService);
      // AND the application login code is not disabled
      jest.spyOn(EnvServiceModule, "getLoginCodeDisabled").mockReturnValue("false");

      // AND user has not accepted terms
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValueOnce({
        accepted_tc: null,
        user_id: "1234",
      } as unknown as UserPreference);

      // AND the component is rendered
      render(<Landing />);

      // WHEN continue as guest is clicked
      await userEvent.click(screen.getByTestId(DATA_TEST_ID.LANDING_GUEST_BUTTON));

      // THEN expect navigation to consent page
      await waitFor(() => {
        expect(useNavigate()).toHaveBeenCalledWith(routerPaths.CONSENT, { replace: true });
      });

      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      ["", "false"], // Login Code is enabled and no application default code set
      ["", "true"], // Login Code is disabled and no application default code set
      ["bar", "true"], // Login Code is disabled, and the application default code set
    ])(
      "should not show guest button when application login code = '%s' and enabled = '%s'",
      (givenApplicationLoginCode, givenIsLoginCodeEnabled) => {
        // GIVEN the application login code set to given
        jest.spyOn(EnvServiceModule, "getApplicationLoginCode").mockReturnValue(givenApplicationLoginCode);

        // AND the application login code is either enabled or disabled
        jest.spyOn(EnvServiceModule, "getLoginCodeDisabled").mockReturnValue(givenIsLoginCodeEnabled);

        // WHEN the component is rendered
        const { container } = render(<Landing />);

        // THEN expect the guest button to not be in the document
        expect(screen.queryByTestId(DATA_TEST_ID.LANDING_GUEST_BUTTON)).not.toBeInTheDocument();

        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();

        // AND to match the snapshot
        expect(container).toMatchSnapshot();
      }
    );

    test("should show guest button when application login code is set and enabled", () => {
      // GIVEN the application login code is set
      const givenApplicationLoginCode = "bar";
      jest.spyOn(EnvServiceModule, "getApplicationLoginCode").mockReturnValue(givenApplicationLoginCode);
      // AND the application login code is not disabled
      jest.spyOn(EnvServiceModule, "getLoginCodeDisabled").mockReturnValue("false");

      // WHEN the component is rendered
      const { container } = render(<Landing />);

      // THEN expect the guest button to be in the document
      expect(screen.getByTestId(DATA_TEST_ID.LANDING_GUEST_BUTTON)).toBeInTheDocument();

      // AND no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      // AND to match the snapshot
      expect(container).toMatchSnapshot();
    });

    test("should handle RestAPIError when continuing as guest", async () => {
      // GIVEN the application login code is set
      const givenApplicationLoginCode = "bar";
      jest.spyOn(EnvServiceModule, "getApplicationLoginCode").mockReturnValue(givenApplicationLoginCode);
      // AND the application login code is not disabled
      jest.spyOn(EnvServiceModule, "getLoginCodeDisabled").mockReturnValue("false");

      // AND the error scenario
      const error = new RestAPIError(
        "FirebaseInvitationCodeAuthenticationService",
        "login",
        "GET",
        "/api/test",
        400,
        "API_ERROR",
        "API Error",
        { message: "Bad Request" }
      );
      jest.spyOn(FirebaseInvitationCodeAuthenticationService, "getInstance").mockReturnValue({
        login: jest.fn().mockRejectedValue(error),
      } as unknown as FirebaseInvitationCodeAuthenticationService);

      // AND the component is rendered
      render(<Landing />);

      // WHEN continue as guest is clicked
      await userEvent.click(screen.getByTestId(DATA_TEST_ID.LANDING_GUEST_BUTTON));

      // THEN expect error to be logged
      expect(console.error).toHaveBeenCalledWith(error);

      // AND the error message to be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        `Failed to login: ${ErrorConstants.USER_FRIENDLY_ERROR_MESSAGES.DATA_VALIDATION_ERROR}`,
        { variant: "error" }
      );
    });

    test("should handle FirebaseError when continuing as guest", async () => {
      // GIVEN the application login code is set
      const givenApplicationLoginCode = "bar";
      jest.spyOn(EnvServiceModule, "getApplicationLoginCode").mockReturnValue(givenApplicationLoginCode);
      // AND the application login code is not disabled
      jest.spyOn(EnvServiceModule, "getLoginCodeDisabled").mockReturnValue("false");

      // AND the error scenario
      const error = new FirebaseError(
        "FirebaseInvitationCodeAuthenticationService",
        "login",
        "auth/error",
        "Firebase Error"
      );
      jest.spyOn(FirebaseInvitationCodeAuthenticationService, "getInstance").mockReturnValue({
        login: jest.fn().mockRejectedValue(error),
      } as unknown as FirebaseInvitationCodeAuthenticationService);

      // AND the component is rendered
      render(<Landing />);

      // WHEN continue as guest is clicked
      await userEvent.click(screen.getByTestId(DATA_TEST_ID.LANDING_GUEST_BUTTON));

      // THEN expect error to be logged
      expect(console.warn).toHaveBeenCalledWith(error);

      // AND the error message to be shown
      // message now comes from i18n translation keys; setupTests mocks i18next.t
      const i18next = require("i18next");
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        `Failed to login: ${i18next.t(USER_FRIENDLY_FIREBASE_ERROR_MESSAGES[FirebaseErrorCodes.INTERNAL_ERROR])}`,
        { variant: "error" }
      );
    });

    test("should handle error when getting user preferences", async () => {
      // GIVEN the application login code is set
      const givenApplicationLoginCode = "bar";
      jest.spyOn(EnvServiceModule, "getApplicationLoginCode").mockReturnValue(givenApplicationLoginCode);
      // AND the application login code is not disabled
      jest.spyOn(EnvServiceModule, "getLoginCodeDisabled").mockReturnValue("false");
      // AND user preferences service throws an error
      const mockError = new Error("Failed to get preferences");
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockImplementationOnce(() => {
        throw mockError;
      });

      // AND successful login
      jest.spyOn(FirebaseInvitationCodeAuthenticationService, "getInstance").mockReturnValue({
        login: jest.fn().mockResolvedValue("mock-token"),
      } as unknown as FirebaseInvitationCodeAuthenticationService);

      // AND the component is rendered
      render(<Landing />);

      // WHEN continue as guest is clicked
      await userEvent.click(screen.getByTestId(DATA_TEST_ID.LANDING_GUEST_BUTTON));

      // THEN expect error to be logged
      expect(console.error).toHaveBeenCalled();

      // AND the error message to be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        "An error occurred while trying to get your preferences: Failed to get preferences",
        { variant: "error" }
      );
    });
  });

  describe("Register button", () => {
    test.each([
      ["register-code-provided"], // Registration code is provided
      [""], // Registration code is not provided
    ])(
      "should show register link when registration is enabled and application default registration code is '%s'",
      (givenApplicationRegistrationCode) => {
        // GIVEN the application registration code set to given
        jest
          .spyOn(EnvServiceModule, "getApplicationRegistrationCode")
          .mockReturnValue(givenApplicationRegistrationCode);

        // AND the application registration is not disabled
        jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("false");

        // WHEN the component is rendered
        const { container } = render(<Landing />);

        // THEN expect the signup button to be in the document
        expect(screen.getByTestId(DATA_TEST_ID.LANDING_SIGNUP_BUTTON)).toBeInTheDocument();

        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();

        // AND to match the snapshot
        expect(container).toMatchSnapshot();
      }
    );

    test.each([
      ["register-code-provided"], // Registration code is provided
      [""], // Registration code is not provided
    ])(
      "should not show register link when registration is disabled and application default registration code is '%s'",
      (givenApplicationRegistrationCode) => {
        // GIVEN the application registration code set to given
        jest
          .spyOn(EnvServiceModule, "getApplicationRegistrationCode")
          .mockReturnValue(givenApplicationRegistrationCode);

        // AND the application registration is disabled
        jest.spyOn(EnvServiceModule, "getRegistrationDisabled").mockReturnValue("true");

        // WHEN the component is rendered
        const { container } = render(<Landing />);

        // THEN expect the signup button to be in the document
        expect(screen.queryByTestId(DATA_TEST_ID.LANDING_SIGNUP_BUTTON)).not.toBeInTheDocument();

        // AND no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();

        // AND to match the snapshot
        expect(container).toMatchSnapshot();
      }
    );
  });
});
