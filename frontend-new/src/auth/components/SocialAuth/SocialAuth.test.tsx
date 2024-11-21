import "src/_test_utilities/consoleMock";
import React from "react";
import { render, waitFor, screen } from "src/_test_utilities/test-utils";
import SocialAuth, { DATA_TEST_ID } from "./SocialAuth";
import { HashRouter } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { mockBrowserIsOnLine, unmockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import FirebaseSocialAuthenticationService from "src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service";
import { act } from "@testing-library/react";
import authStateService from "src/auth/services/AuthenticationState.service";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import {
  SensitivePersonalDataRequirement,
  Language,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { TabiyaUser } from "src/auth/auth.types";

// Mock the envService module
jest.mock("src/envService", () => ({
  getFirebaseAPIKey: jest.fn(() => "mock-api-key"),
  getFirebaseDomain: jest.fn(() => "mock-auth-domain"),
  getBackendUrl: jest.fn(() => "mock-backend-url"),
}));

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
      <HashRouter>
        <SocialAuth
          postLoginHandler={givenNotifyOnLogin}
          isLoading={givenIsLoading}
          notifyOnLoading={givenNotifyOnLoading}
        />
      </HashRouter>
    );

    // THEN expect the component to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON)).toBeInTheDocument();
  });

  test.each([
    ["accepted", new Date(), routerPaths.ROOT],
    ["not accepted", undefined, routerPaths.CONSENT],
  ])(
    "it should handle successful sign-in for a user who has %s terms and conditions",
    async (_description: string, tc: Date | undefined, expectedPath: string) => {
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
      jest.spyOn(authStateService.getInstance(), "setUser").mockImplementation((user: TabiyaUser | null) => {
        return givenUser;
      });
      // AND the user preferences exist for the user
      jest.spyOn(userPreferencesStateService, "getUserPreferences").mockReturnValue({
        user_id: givenUser.id,
        language: Language.en,
        sessions: [1],
        accepted_tc: tc,
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      });

      // WHEN the component is rendered
      render(
        <HashRouter>
          <SocialAuth
            postLoginHandler={givenNotifyOnLogin}
            isLoading={givenIsLoading}
            notifyOnLoading={givenNotifyOnLoading}
          />
        </HashRouter>
      );
      // AND the login button is clicked
      const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
      await act(() => {
        loginButton.click();
      });

      // THEN expect the user to be redirected to the correct path
      await waitFor(() => {
        expect(givenNotifyOnLogin).toHaveBeenCalled();
      });
    }
  );

  test("should handle sign-in failure", async () => {
    // GIVEN a SocialAuth component
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoading = false;
    const givenNotifyOnLoading = jest.fn();
    // WHEN the sign-in fails
    const loginWithGoogleMock = jest.fn().mockImplementation((elementId: string, config: any) => {
      config.callbacks.signInFailure(new Error("Sign-in failed"));
    });
    const getFirebaseSocialAuthInstanceSpy = jest.spyOn(FirebaseSocialAuthenticationService, "getInstance");
    getFirebaseSocialAuthInstanceSpy.mockReturnValue({
      loginWithGoogle: loginWithGoogleMock,
    } as unknown as FirebaseSocialAuthenticationService);

    render(
      <HashRouter>
        <SocialAuth
          postLoginHandler={givenNotifyOnLogin}
          isLoading={givenIsLoading}
          notifyOnLoading={givenNotifyOnLoading}
        />
      </HashRouter>
    );
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
      <HashRouter>
        <SocialAuth
          postLoginHandler={givenNotifyOnLogin}
          isLoading={givenIsLoading}
          notifyOnLoading={givenNotifyOnLoading}
        />
      </HashRouter>
    );

    // THEN expect the message text to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FIREBASE_FALLBACK_TEXT)).toBeInTheDocument();
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
    } as unknown as FirebaseSocialAuthenticationService);
    // WHEN the component is rendered
    render(
      <HashRouter>
        <SocialAuth
          postLoginHandler={givenNotifyOnLogin}
          isLoading={givenIsLoading}
          notifyOnLoading={givenNotifyOnLoading}
        />
      </HashRouter>
    );

    // AND the login button is clicked
    const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
    await act(() => {
      loginButton.click();
    });

    // THEN expect notifyOnLoading to have been called with true
    expect(givenNotifyOnLoading).toHaveBeenCalledWith(true);
  });
});
