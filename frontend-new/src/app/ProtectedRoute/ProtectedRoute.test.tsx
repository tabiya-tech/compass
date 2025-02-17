// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { routerPaths } from "src/app/routerPaths";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import authStateService from "src/auth/services/AuthenticationState.service";
import {
  Language,
  SensitivePersonalDataRequirement,
  UserPreference,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";

// mock the FirebaseSocialAuthentication service
jest.mock("src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        logout: jest.fn(),
      };
    }),
  };
});

// mock the util functions
jest.mock("src/app/ProtectedRoute/util", () => ({
  isSensitiveDataValid: jest.fn(),
  isAcceptedTCValid: jest.fn(),
}));

// Import the mocked functions
import { isSensitiveDataValid, isAcceptedTCValid } from "./util";

describe("ProtectedRoute test", () => {
  describe("login page", () => {
    test("should redirect to the login page if the user is not logged in", () => {
      // GIVEN the user select a page that require authentication
      const mockUser = undefined;
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });

      // WHEN the user navigates to the page
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.ROOT,
            element: (
              <ProtectedRoute>
                <div>Protected page</div>
              </ProtectedRoute>
            ),
          },
          {
            path: routerPaths.LOGIN,
            element:
              <ProtectedRoute>
                <div>Login Page</div>
              </ProtectedRoute>,
          },
        ],
        {
          initialEntries: [routerPaths.ROOT],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to be redirected to the login page
      expect(screen.getByText("Login Page")).toBeInTheDocument();
      expect(screen.queryByText("Protected page")).not.toBeInTheDocument();
    });

    test("should redirect logged-in user to root page", () => {
      // GIVEN a user is logged in
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });
      // AND has accepted the terms and conditions
      const mockUserPreferences: UserPreference = {
        user_id: "user1",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: true,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        sessions: [],
        sessions_with_feedback: [],
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });
      // AND mock the util functions
      (isAcceptedTCValid as jest.Mock).mockReturnValue(true);
      (isSensitiveDataValid as jest.Mock).mockReturnValue(true);

      // WHEN the user navigates to the login page
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.LOGIN,
            element: (
              <ProtectedRoute>
                <div>Login Page</div>
              </ProtectedRoute>
            ),
          },
          {
            path: routerPaths.ROOT,
            element: <ProtectedRoute>
              <div>Chat Page</div>
            </ProtectedRoute>,
          },
        ],
        {
          initialEntries: [routerPaths.LOGIN],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to be redirected to the root page
      expect(screen.getByText("Chat Page")).toBeInTheDocument();
      expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    });

    test("should render the login page if no user is found", () => {
      // GIVEN there is no user
      const mockUser = undefined;
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });
      const mockUserPreferences = undefined;
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });

      // WHEN the user navigates to the login page
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.LOGIN,
            element: (
              <ProtectedRoute>
                <div>Login Page</div>
              </ProtectedRoute>
            ),
          },
          {
            path: routerPaths.ROOT,
            element: (
              <ProtectedRoute>
                <div>Chat Page</div>
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: [routerPaths.ROOT],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to stay on the login page
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
  });

  describe("chat page", () => {
    test("should redirect to sensitive data page if the user is logged in and has accepted the terms and condition but has not provided sensitive data", () => {
      // GIVEN a user is logged in and has accepted the terms and conditions
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });
      const mockUserPreferences: UserPreference = {
        user_id: "user1",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        sessions: [],
        sessions_with_feedback: [],
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });
      // AND the user has accpted TC
      (isAcceptedTCValid as jest.Mock).mockReturnValue(true);

      // AND the user has not provided sensitive data
      (isSensitiveDataValid as jest.Mock).mockReturnValue(false);

      // WHEN the user navigates to the chat page
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.ROOT,
            element: (
              <ProtectedRoute>
                <div>Chat Page</div>
              </ProtectedRoute>
            ),
          },
          {
            path: routerPaths.SENSITIVE_DATA,
            element: (
              <ProtectedRoute>
                <div>Sensitive Data Page</div>
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: [routerPaths.ROOT],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to be redirected to the sensitive data page
      expect(screen.getByText("Sensitive Data Page")).toBeInTheDocument();
      expect(screen.queryByText("Chat Page")).not.toBeInTheDocument();
    });

    test("should redirect to chat page if the user is logged in and has accepted the terms and conditions and has provided sensitive data", () => {
      // GIVEN a user is logged in and has accepted the terms and conditions and has provided sensitive data
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });
      const mockUserPreferences: UserPreference = {
        user_id: "user1",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: true,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        sessions: [],
        sessions_with_feedback: [],
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });

      // AND the user has accpted TC
      (isAcceptedTCValid as jest.Mock).mockReturnValue(true);

      // AND the user has provided sensitive data
      (isSensitiveDataValid as jest.Mock).mockReturnValue(true);

      // WHEN the user navigates to the chat page
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.ROOT,
            element: (
              <ProtectedRoute>
                <div>Chat Page</div>
              </ProtectedRoute>
            ),
          },
          {
            path: routerPaths.SENSITIVE_DATA,
            element: (
              <ProtectedRoute>
                <div>Sensitive Data Page</div>
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: [routerPaths.ROOT],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to be redirected to the chat page
      expect(screen.getByText("Chat Page")).toBeInTheDocument();
      expect(screen.queryByText("Sensitive Data Page")).not.toBeInTheDocument();
    });
  })

  describe("verify email page", () => {
    test("should render the verify email page when the user wants to access it", () => {
      // GIVEN the mock user preferences
      const mockUserPreferences = {
        user_id: "user1",
        language: Language.en,
        accepted_tc: new Date(),
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });

      // WHEN the user navigates to the verify email page
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.VERIFY_EMAIL,
            element: (
              <ProtectedRoute>
                <div>Verify email page</div>
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: [routerPaths.VERIFY_EMAIL],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to stay on the verify email page
      expect(screen.getByText("Verify email page")).toBeInTheDocument();
    });
  });

  describe("consent page", () => {
    test("should redirect to the consent page when the user has not accepted the terms and conditions", () => {
      // GIVEN a mocked logged-in user
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });
      // AND has not accepted the terms and conditions
      const mockUserPreferences: UserPreference = {
        user_id: "user1",
        language: Language.en,
        accepted_tc: undefined,
        has_sensitive_personal_data: true,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        sessions: [],
        sessions_with_feedback: [],
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });
      // AND mock isAcceptedTCValid to return false
      (isAcceptedTCValid as jest.Mock).mockReturnValue(false);

      // WHEN the user navigates to any page
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.ROOT,
            element: (
              <ProtectedRoute>
                <div>Any Page</div>
              </ProtectedRoute>
            ),
          },
          {
            path: routerPaths.CONSENT,
            element: <div>Consent Page</div>,
          },
        ],
        {
          initialEntries: [routerPaths.ROOT],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to navigate to the consent page
      expect(screen.getByText("Consent Page")).toBeInTheDocument();
      expect(screen.queryByText("Any Page")).not.toBeInTheDocument();
    });

    test("should stay on the consent page when the terms and conditions are not accepted", () => {
      // GIVEN a mocked logged-in user
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });
      // AND has not accepted the terms and conditions
      const mockUserPreferences: UserPreference = {
        user_id: "user1",
        language: Language.en,
        accepted_tc: undefined,
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_AVAILABLE,
        sessions: [],
        sessions_with_feedback: [],
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });
      // AND mock isAcceptedTCValid to return false
      (isAcceptedTCValid as jest.Mock).mockReturnValue(false);

      // WHEN the user navigates to the consent page
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.CONSENT,
            element: (
              <ProtectedRoute>
                <div>Consent Page</div>
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: [routerPaths.CONSENT],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to stay on the consent page
      expect(screen.getByText("Consent Page")).toBeInTheDocument();
    });

    test("should redirect to the chat page when the user has accepted the terms and conditions", () => {
      // GIVEN a mocked logged-in user
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });
      // AND has accepted the terms and conditions
      const mockUserPreferences: UserPreference = {
        user_id: "user1",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: true,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        sessions: [],
        sessions_with_feedback: [],
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });
      // AND mock isAcceptedTCValid to return true
      (isAcceptedTCValid as jest.Mock).mockReturnValue(true);
      // AND mock isSensitiveDataValid to return true
      (isSensitiveDataValid as jest.Mock).mockReturnValue(true);

      // WHEN the user navigates to the consent page
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.CONSENT,
            element: (
              <ProtectedRoute>
                <div>Consent Page</div>
              </ProtectedRoute>
            ),
          },
          {
            path: routerPaths.ROOT,
            element: <div>Chat Page</div>,
          },
        ],
        {
          initialEntries: [routerPaths.CONSENT],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to navigate to the chat page
      expect(screen.getByText("Chat Page")).toBeInTheDocument();
      expect(screen.queryByText("Consent Page")).not.toBeInTheDocument();
    });
  });

  describe("PII page", () => {
    test("should redirect to the PII page when the user is required to provide sensitive data", () => {
      // GIVEN a mocked logged-in user
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });
      // AND the user is required to provide sensitive data
      const mockUserPreferences = {
        user_id: "user1",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });
      // AND mock the util functions
      (isAcceptedTCValid as jest.Mock).mockReturnValue(true);
      (isSensitiveDataValid as jest.Mock).mockReturnValue(false);

      // WHEN the user tries to access the chat page
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.ROOT,
            element: (
              <ProtectedRoute>
                <div>Chat Page</div>
              </ProtectedRoute>
            ),
          },
          {
            path: routerPaths.SENSITIVE_DATA,
            element: <div>Sensitive Data Page</div>,
          },
        ],
        {
          initialEntries: [routerPaths.ROOT],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to navigate to the PII page
      expect(screen.getByText("Sensitive Data Page")).toBeInTheDocument();
      expect(screen.queryByText("Chat Page")).not.toBeInTheDocument();
    });

    test("should redirect to the chat page when the user has provided sensitive data", () => {
      // GIVEN a mocked logged-in user
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });
      // AND the user has provided sensitive data
      const mockUserPreferences: UserPreference = {
        user_id: "user1",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: true,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        sessions_with_feedback: [],
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });
      // AND mock the util functions
      (isAcceptedTCValid as jest.Mock).mockReturnValue(true);
      (isSensitiveDataValid as jest.Mock).mockReturnValue(true);

      // WHEN the user tries to access the sensitive data page
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.SENSITIVE_DATA,
            element: (
              <ProtectedRoute>
                <div>Sensitive Data Page</div>
              </ProtectedRoute>
            ),
          },
          {
            path: routerPaths.ROOT,
            element: <div>Chat Page</div>,
          },
        ],
        {
          initialEntries: [routerPaths.SENSITIVE_DATA],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to navigate to the chat page
      expect(screen.getByText("Chat Page")).toBeInTheDocument();
      expect(screen.queryByText("Sensitive Data Page")).not.toBeInTheDocument();
    });
  });

  describe("settings page", () => {
    test("should allow access to settings page when user is logged in and has completed all requirements", () => {
      // GIVEN a user is logged in
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });

      // AND user has all required preferences
      const mockUserPreferences: UserPreference = {
        user_id: "user1",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: true,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        sessions: [],
        sessions_with_feedback: [],
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });

      // AND user has accepted TC and provided sensitive data
      (isAcceptedTCValid as jest.Mock).mockReturnValue(true);
      (isSensitiveDataValid as jest.Mock).mockReturnValue(true);

      // WHEN the user navigates to the settings page
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.SETTINGS,
            element: (
              <ProtectedRoute>
                <div>Settings Page</div>
              </ProtectedRoute>
            ),
          },
          {
            path: routerPaths.ROOT,
            element: (
              <ProtectedRoute>
                <div>Root Page</div>
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: [routerPaths.SETTINGS],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to remain on the settings page
      expect(screen.getByText("Settings Page")).toBeInTheDocument();
      expect(screen.queryByText("Root Page")).not.toBeInTheDocument();
    });

    test("should redirect to login page when trying to access settings without being logged in", () => {
      // GIVEN the user is not logged in
      const mockUser = undefined;
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });

      // AND no user preferences exist
      const mockUserPreferences = undefined;
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });

      // WHEN the user tries to navigate to settings
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.SETTINGS,
            element: (
              <ProtectedRoute>
                <div>Settings Page</div>
              </ProtectedRoute>
            ),
          },
          {
            path: routerPaths.LOGIN,
            element: (
              <ProtectedRoute>
                <div>Login Page</div>
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: [routerPaths.SETTINGS],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to be redirected to the login page
      expect(screen.getByText("Login Page")).toBeInTheDocument();
      expect(screen.queryByText("Settings Page")).not.toBeInTheDocument();
    });

    test("should redirect to consent page when trying to access settings without accepting TC", () => {
      // GIVEN a user is logged in
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });

      // AND user has preferences but hasn't accepted TC
      const mockUserPreferences: UserPreference = {
        user_id: "user1",
        language: Language.en,
        accepted_tc: undefined,
        has_sensitive_personal_data: true,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        sessions: [],
        sessions_with_feedback: [],
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });

      // AND TC is not valid
      (isAcceptedTCValid as jest.Mock).mockReturnValue(false);
      (isSensitiveDataValid as jest.Mock).mockReturnValue(true);

      // WHEN the user tries to navigate to settings
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.SETTINGS,
            element: (
              <ProtectedRoute>
                <div>Settings Page</div>
              </ProtectedRoute>
            ),
          },
          {
            path: routerPaths.CONSENT,
            element: (
              <ProtectedRoute>
                <div>Consent Page</div>
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: [routerPaths.SETTINGS],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to be redirected to the consent page
      expect(screen.getByText("Consent Page")).toBeInTheDocument();
      expect(screen.queryByText("Settings Page")).not.toBeInTheDocument();
    });

    test("should redirect to sensitive data page when trying to access settings without providing required sensitive data", () => {
      // GIVEN a user is logged in
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });

      // AND user has preferences and accepted TC but hasn't provided sensitive data
      const mockUserPreferences: UserPreference = {
        user_id: "user1",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        sessions_with_feedback: [],
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });

      // AND TC is valid but sensitive data is not
      (isAcceptedTCValid as jest.Mock).mockReturnValue(true);
      (isSensitiveDataValid as jest.Mock).mockReturnValue(false);

      // WHEN the user tries to navigate to settings
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.SETTINGS,
            element: (
              <ProtectedRoute>
                <div>Settings Page</div>
              </ProtectedRoute>
            ),
          },
          {
            path: routerPaths.SENSITIVE_DATA,
            element: (
              <ProtectedRoute>
                <div>Sensitive Data Page</div>
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: [routerPaths.SETTINGS],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to be redirected to the sensitive data page
      expect(screen.getByText("Sensitive Data Page")).toBeInTheDocument();
      expect(screen.queryByText("Settings Page")).not.toBeInTheDocument();
    });
  });
});
