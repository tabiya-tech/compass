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
import { canAccessPIIPage } from "./util";

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

// mock the canAccessPIIPage function
jest.mock("src/app/ProtectedRoute/util", () => ({
  canAccessPIIPage: jest.fn(),
  canAccessChatPage: jest.fn(),
}));

describe("ProtectedRoute test", () => {
  describe("login page", () => {
    test("should redirect to the login page if the user is not logged in and authentication is required", () => {
      // GIVEN the user select a page that require authentication
      const router = createMemoryRouter([
        {
          path: routerPaths.ROOT,
          element: (
            <ProtectedRoute>
              <div>Protected page</div>
            </ProtectedRoute>
          ),
        },
      ]);

      // WHEN the user navigates to the page
      render(<RouterProvider router={router} />);

      // THEN expect the user to be redirected to the login page
      expect(screen.queryByText("protected page")).not.toBeInTheDocument();
    });

    test("should redirect logged-in user to root page if authentication is not required", () => {
      // GIVEN a user is logged in
      // AND the user select a page that does not require authentication
      const router = createMemoryRouter([
        {
          path: routerPaths.LOGIN,
          element: (
            <ProtectedRoute>
              <div>Unprotected page</div>
            </ProtectedRoute>
          ),
        },
      ]);

      // WHEN the user navigates to the page
      render(<RouterProvider router={router} />);

      // THEN expect the user to be redirected to the root page
      expect(screen.queryByText("Unprotected component")).not.toBeInTheDocument();
    });

    test("should render the login page if no user is found", () => {
      // GIVEN there is no user
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
        ],
        {
          initialEntries: [routerPaths.LOGIN],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to navigate to the login page
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
  });

  describe("verify email page", () => {
    test("should redirect to the verify email page when the user wants to access it", () => {
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

      // THEN expect the user to navigate to the verify email page
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
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_AVAILABLE,
        sessions: [],
        sessions_with_feedback: [],
      };
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
            path: routerPaths.CONSENT,
            element: <div>Consent Page</div>,
          },
        ],
        {
          initialEntries: [routerPaths.LOGIN],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to navigate to the consent page
      expect(screen.getByText("Consent Page")).toBeInTheDocument();
      expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    });

    test("should redirect to the chat page when the user is logged in and has accepted the terms and conditions", () => {
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
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_AVAILABLE,
        sessions: [],
        sessions_with_feedback: [],
      };
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
            element: <div>Chat Page</div>,
          },
        ],
        {
          initialEntries: [routerPaths.LOGIN],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to navigate to the chat page
      expect(screen.getByText("Chat Page")).toBeInTheDocument();
      expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    });

    test("should stay on the consent page when the terms and conditions are not accepted and the user wants to access the chat page", () => {
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

      // WHEN the user navigates to the page
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

      // THEN expect the user to stay on the consent page
      expect(screen.getByText("Consent Page")).toBeInTheDocument();
      expect(screen.queryByText("Chat Page")).not.toBeInTheDocument();
    });

    test("should redirect to the consent page from any route when terms and conditions are not accepted", () => {
      // GIVEN a mocked logged-in user
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });

      // AND the user has not accepted the terms and conditions
      const mockUserPreferences = {
        user_id: "user1",
        language: "en",
        accepted_tc: undefined,
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });

      // WHEN the user navigates to any route
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.SETTINGS,
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
          initialEntries: [routerPaths.SETTINGS],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to be redirected to the consent page
      expect(screen.getByText("Consent Page")).toBeInTheDocument();
      expect(screen.queryByText("Any Page")).not.toBeInTheDocument();
    });

    test("should render the content of the page when terms and conditions are accepted", () => {
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });

      // AND the user has accepted the terms and conditions
      const mockUserPreferences = {
        user_id: "user1",
        language: "en",
        accepted_tc: new Date(),
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });

      // WHEN the user navigates to any route
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.SETTINGS,
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
          initialEntries: [routerPaths.SETTINGS],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the user to be redirected to that page
      expect(screen.getByText("Any Page")).toBeInTheDocument();
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
      // AND the user is allowed to access the PII page
      (canAccessPIIPage as jest.Mock).mockReturnValue(true);

      // WHEN the user try to access the chat page
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

    test("should redirect to the chat page when the user is not required to provide sensitive data", () => {
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
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_AVAILABLE,
      };
      UserPreferencesStateService.getInstance = jest.fn().mockReturnValue({
        getUserPreferences: jest.fn().mockReturnValue(mockUserPreferences),
      });
      // AND the user is allowed to access the chat page
      (canAccessPIIPage as jest.Mock).mockReturnValue(false);

      // WHEN the user try to access the chat page
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

    test("should redirect to the chat page when the user is required to provide sensitive dataa", () => {
      // GIVEN a mocked logged-in user
      const mockUser = { id: "user1" };
      authStateService.getInstance = jest.fn().mockReturnValue({
        getUser: jest.fn().mockReturnValue(mockUser),
      });
      // AND the user is required to provide sensitive data and has provided it
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
      // AND the user is allowed to access the chat page
      (canAccessPIIPage as jest.Mock).mockReturnValue(false);

      // WHEN the user try to access the sensitive data page
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
});
