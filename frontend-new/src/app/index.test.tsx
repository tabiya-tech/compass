// mute the console
import "src/_test_utilities/consoleMock";

import App, { SNACKBAR_KEYS } from "./index";
import { render, screen, waitFor, act } from "src/_test_utilities/test-utils";
import { unmockBrowserIsOnLine, mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { DEFAULT_SNACKBAR_AUTO_HIDE_DURATION, useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import * as AuthenticationFactoryModule from "src/auth/services/Authentication.service.factory";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { PersistentStorageService } from "./PersistentStorageService/PersistentStorageService";
import {
  Language,
  SensitivePersonalDataRequirement,
  UserPreference,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { DATA_TEST_ID as BACKDROP_DATA_TEST_ID } from "src/theme/Backdrop/Backdrop";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";


// mock the snackbar
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      DEFAULT_SNACKBAR_AUTO_HIDE_DURATION: actual.DEFAULT_SNACKBAR_AUTO_HIDE_DURATION,
      enqueueSnackbar: jest.fn(),
      closeSnackbar: jest.fn(),
    }),
  };
});

// mock the createHashRouter from react-router-dom
jest.mock("react-router-dom", () => {
  return {
    __esModule: true,
    createHashRouter: jest.fn().mockImplementation((routes) => {
      return {
        routes,
      };
    }),
  };
});

// mock the react-router-dom
jest.mock("react-router-dom", () => {
  return {
    __esModule: true,
    createHashRouter: jest.fn().mockImplementation(() => {
      return {
        routes: [],
      };
    }),
    HashRouter: jest.fn().mockImplementation(({ children }) => <div data-testid="hash-router-id">{children}</div>),
    Route: jest.fn().mockImplementation(({ children }) => <div data-testid="route-id">{children}</div>),
    Routes: jest.fn().mockImplementation(({ children }) => <div data-testid="routes-id">{children}</div>),
    NavLink: jest.fn().mockImplementation(({ children }) => <div data-testid="nav-link-id">{children}</div>),
    RouterProvider: jest.fn(),
  };
});

async function waitForAppLoadingToFinish() {
  // Wait for the backdrop to disappear so that we know the app has finished loading and the dom has settled
  // not doing this can cause the Warning: An update to App inside a test was not wrapped in act(...).
  await waitFor(() => {
    expect(screen.getByTestId(BACKDROP_DATA_TEST_ID.BACKDROP_CONTAINER)).toBeInTheDocument();
  });
}

describe("index", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all method mocks on the singletons that may have been mocked
    // As a good practice, we should the mock*Once() methods to avoid side effects between tests
    // As a precaution, we reset all method mocks to ensure that no side effects are carried over between tests
    resetAllMethodMocks(UserPreferencesService.getInstance());

    unmockBrowserIsOnLine();
    // Mock the authenticationServiceFactory to return a mock instance of the authentication service
    const mockAuthService = {
      getUser: jest.fn().mockReturnValue({ id: "123", email: "test@test.com" }),
      isTokenValid: jest.fn().mockReturnValue({ isValid: true }),
      logout: jest.fn(),
      cleanup: jest.fn(),
    } as any;
    jest
      .spyOn(AuthenticationFactoryModule.default, "getCurrentAuthenticationService")
      .mockReturnValue(mockAuthService);
    // Mock the AuthenticationServiceFactory to reset app state properly
    // since we clean up on application startup
    jest.spyOn(AuthenticationFactoryModule.default, "resetAuthenticationState").mockResolvedValue();
  });
  describe("main compass app test", () => {
    test("should render app successfully", async () => {
      // GIVEN AuthenticationStateService.loadToken will successfully load the token
      jest.spyOn(AuthenticationStateService.prototype, "loadToken").mockImplementation(() => {})

      // WHEN the app is rendered
      render(<App />);

      // THEN wait for the app to finish loading
      await waitForAppLoadingToFinish();

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      // AND the HASH ROUTER to be in the document
      const router = screen.getByTestId("hash-router-id");
      expect(router).toBeInTheDocument();
    });

    describe("when the app is offline/online", () => {
      const expectedOfflineSnackBar = {
        variant: "offline",
        key: SNACKBAR_KEYS.OFFLINE_ERROR,
        preventDuplicate: true,
        persist: true,
        action: [],
        anchorOrigin: {
          horizontal: "center",
          vertical: "top",
        },
        style: {
          margin: "0 auto",
          minWidth: "0",
          width: "fit-content",
        },
      };
      const expectedOnlineSnackBar = {
        variant: "success",
        key: SNACKBAR_KEYS.ONLINE_SUCCESS,
        preventDuplicate: true,
        autoHideDuration: DEFAULT_SNACKBAR_AUTO_HIDE_DURATION,
      };
      const expectedMessageOffline = `You are offline`;
      const expectedMessageOnline = `You are back online`;

      test("should show the online then offline notification when the browser switches from offline->online->offline", async () => {
        // GIVEN that the app is initially rendered while the browser is offline
        mockBrowserIsOnLine(false);
        render(<App />);

        // THEN wait for the app to finish loading
        await waitForAppLoadingToFinish();

        // AND expect the offline notification to be shown
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expectedMessageOffline, expectedOfflineSnackBar);

        // AND WHEN the browser goes online
        act(() => mockBrowserIsOnLine(true));

        // THEN expect the offline notification to disappear
        expect(useSnackbar().closeSnackbar).toHaveBeenCalledWith(SNACKBAR_KEYS.OFFLINE_ERROR);
        // AND the online notification to be shown
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expectedMessageOnline, expectedOnlineSnackBar);

        // AND WHEN the browser goes offline again
        act(() => mockBrowserIsOnLine(false));
        // THEN  the online notification to be shown
        expect(useSnackbar().closeSnackbar).toHaveBeenCalledWith(SNACKBAR_KEYS.ONLINE_SUCCESS);
        // AND the online notification to be shown
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expectedMessageOffline, expectedOfflineSnackBar);
      });

      test("should show the offline notification when the app renders for the first time and the browser is offline", async () => {
        // GIVEN the browser is offline
        mockBrowserIsOnLine(false);

        // WHEN the app is rendered
        render(<App />);

        // THEN wait for the app to finish loading
        await waitForAppLoadingToFinish();

        // AND  the offline warning should be shown
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expectedMessageOffline, expectedOfflineSnackBar);
      });

      test("should not show the online notification when the app renders for the first time and the browser is online", async () => {
        // GIVEN that the browser is online
        mockBrowserIsOnLine(true);

        // WHEN the app is rendered
        render(<App />);

        // THEN wait for the app to finish loading
        await waitForAppLoadingToFinish();

        // AND  expect the offline and online notification to not be shown
        expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
      });
    });
  });

  describe("app loading sequence", () => {
    test("should show backdrop while loading", async () => {
      // GIVEN some authenticated user with preferences
      jest.spyOn(PersistentStorageService, "getToken").mockReturnValue("valid-token");

      let resolvePreferences!: (value: UserPreference) => void;
      const preferencesPromise = new Promise<UserPreference>((resolve) => {
        resolvePreferences = resolve;
      });

      const mockPreferences = {
        user_id: "foo",
        language: Language.en,
        sessions: [123],
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        getActiveSessionId: jest.fn().mockReturnValue(123),
        user_feedback_answered_questions: {},
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        experiments: {},
      };

      jest.spyOn(UserPreferencesService.getInstance(), "getUserPreferences").mockReturnValueOnce(preferencesPromise);

      // WHEN the app is rendered
      render(<App />);

      // THEN expect the backdrop to be shown immediately
      expect(screen.getByTestId(BACKDROP_DATA_TEST_ID.BACKDROP_CONTAINER)).toBeInTheDocument();

      // WHEN the preferences are resolved
      act(() => resolvePreferences(mockPreferences));


      // THEN the backdrop should be hidden
      await waitFor(() => {
        expect(screen.queryByTestId(BACKDROP_DATA_TEST_ID.BACKDROP_CONTAINER)).not.toBeInTheDocument();
      });

      // AND the router should be rendered with the protected routes
      expect(screen.getByTestId("hash-router-id")).toBeInTheDocument();
    });

    test("should properly clean up on unmount", async () => {
      // GIVEN mocked services and timers
      jest.spyOn(PersistentStorageService, "getToken").mockReturnValue("valid-token");

      const mockPreferences = {
        user_id: "foo",
        language: Language.en,
        sessions: [123],
        user_feedback_answered_questions: {},
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        experiments: {},
      };

      jest.spyOn(UserPreferencesService.getInstance(), "getUserPreferences").mockResolvedValue(mockPreferences);

      // WHEN the app is rendered
      const { unmount } = render(<App />);

      // AND we wait for the initial loading
      await waitFor(() => {
        expect(screen.getByTestId(BACKDROP_DATA_TEST_ID.BACKDROP_CONTAINER)).toBeInTheDocument();
      });

      // WHEN the component is unmounted
      unmount();

      // THEN the cleanup method should have been called
      expect(AuthenticationFactoryModule.default.getCurrentAuthenticationService()!.cleanup).toHaveBeenCalled();

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

});
