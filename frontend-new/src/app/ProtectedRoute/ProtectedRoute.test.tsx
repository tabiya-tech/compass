// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { routerPaths } from "src/app/routerPaths";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

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

// mock the lazyWithPreload
jest.mock("src/utils/preloadableComponent/PreloadableComponent", () => {
  return {
    lazyWithPreload: jest.fn().mockImplementation((fn) => {
      return {
        preload: jest.fn(() => Promise.resolve()),
      };
    }),
  };
});

// mock the SensitiveDataForm component
jest.mock("src/sensitiveData/components/sensitiveDataForm/SensitiveDataForm", () => ({
  __esModule: true,
  default: jest.fn(),
}));

// mock the Chat component
jest.mock("src/chat/Chat", () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Import the mocked functions
import { isSensitiveDataValid, isAcceptedTCValid } from "./util";
import { resetAllMethodMocks } from "src/_test_utilities/resetAllMethodMocks";
import { lazyWithPreload } from "../../utils/preloadableComponent/PreloadableComponent";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { TabiyaUser } from "../../auth/auth.types";

const getUser = (loggedIn: boolean) => {
  const givenUser = loggedIn ? { id: "user1" } as TabiyaUser : null;
  jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(givenUser);
};

const getUserPreferences = (acceptedTC: Date | undefined, hasSensitiveData: boolean, sensitiveDataRequirement: SensitivePersonalDataRequirement) => {
  const givenPreferences: UserPreference = {
    user_id: "user1",
    language: Language.en,
    accepted_tc: acceptedTC,
    has_sensitive_personal_data: hasSensitiveData,
    sensitive_personal_data_requirement: sensitiveDataRequirement,
    sessions: [],
    user_feedback_answered_questions: {},
  };
  jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(givenPreferences);
}

describe("ProtectedRoute test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all method mocks on the singletons that may have been mocked
    // As a good practice, we should the mock*Once() methods to avoid side effects between tests
    // As a precaution, we reset all method mocks to ensure that no side effects are carried over betwe
    resetAllMethodMocks(UserPreferencesStateService.getInstance());
    resetAllMethodMocks(AuthenticationStateService.getInstance());
  })

  describe("login page", () => {
    test("should redirect to the login page if the user is not logged in", () => {
      // GIVEN the user select a page that require authentication
      getUser(false);

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
      getUser(true);
      // AND has accepted the terms and conditions
      getUserPreferences(new Date(), true, SensitivePersonalDataRequirement.NOT_REQUIRED);

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
      getUser(false);


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
      // GIVEN a user is logged in
      getUser(true);
      // AND the user has accepted the terms and conditions
      getUserPreferences(new Date(), true, SensitivePersonalDataRequirement.NOT_REQUIRED);

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
      // GIVEN a user is logged in
      getUser(true);
      // AND has accepted the terms and conditions and has provided sensitive data
      getUserPreferences(new Date(), true, SensitivePersonalDataRequirement.NOT_REQUIRED);

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
      getUserPreferences(new Date(), true, SensitivePersonalDataRequirement.NOT_REQUIRED);

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
      // GIVEN a user is logged in
      getUser(true);
      // AND has not accepted the terms and conditions
      getUserPreferences(undefined, true, SensitivePersonalDataRequirement.NOT_REQUIRED);
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
      // GIVEN a user is logged in
      getUser(true);
      // AND has not accepted the terms and conditions
      getUserPreferences(undefined, false, SensitivePersonalDataRequirement.NOT_AVAILABLE);

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
      // GIVEN a user is logged in
      getUser(true);
      // AND has accepted the terms and conditions
      getUserPreferences(new Date(), true, SensitivePersonalDataRequirement.NOT_REQUIRED);
      // AND the user has accepted the terms and conditions
      (isAcceptedTCValid as jest.Mock).mockReturnValue(true);

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
      // GIVEN a user is logged in
      getUser(true);
      // AND the user is required to provide sensitive data
      getUserPreferences(new Date(), false, SensitivePersonalDataRequirement.REQUIRED);
      // AND the user has accepted the terms and conditions
      (isAcceptedTCValid as jest.Mock).mockReturnValue(true);
      // AND the user has not provided sensitive data
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
      // GIVEN a user is logged in
      getUser(true);
      // AND the user has provided sensitive data
      getUserPreferences(new Date(), true, SensitivePersonalDataRequirement.REQUIRED);
      // AND the user has accepted the terms and conditions
      (isAcceptedTCValid as jest.Mock).mockReturnValue(true);
      // AND the user has provided sensitive data
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
      getUser(true);
      // AND user has all required preferences
      getUserPreferences(new Date(), true, SensitivePersonalDataRequirement.NOT_REQUIRED);

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
      getUser(false);
      // AND no user preferences exist
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(null);

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
      getUser(true);
      // AND user has preferences but hasn't accepted TC
      getUserPreferences(undefined, true, SensitivePersonalDataRequirement.NOT_REQUIRED);

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
      getUser(true);
      // AND user has preferences and accepted TC but hasn't provided sensitive data
      getUserPreferences(new Date(), false, SensitivePersonalDataRequirement.REQUIRED);

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

  describe("preload", () => {
    test("should preload chat page", async () => {
      // GIVEN the user is logged in
      getUser(true);
      // WHEN the chat page is rendered
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.LOGIN,
            element: (
              <ProtectedRoute><div>Login</div></ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: [routerPaths.LOGIN],
        }
      );
      render(<RouterProvider router={router} />);

      // THEN expect the chat page to be preloaded
      expect(lazyWithPreload).toHaveBeenCalledTimes(1);
      expect((lazyWithPreload as jest.Mock).mock.results[0].value.preload).toHaveBeenCalled();

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      [SensitivePersonalDataRequirement.REQUIRED],
      [SensitivePersonalDataRequirement.NOT_REQUIRED],
    ])("should preload the sensitive data form if the user has sensitive data requirement %s", async (requirement) => {
      // GIVEN the user has sensitive data requirement
      getUserPreferences(new Date(), false, requirement);
      // WHEN a component is rendered with the ProtectedRoute is rendered
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.LOGIN,
            element: (
              <ProtectedRoute><div>Login</div></ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: [routerPaths.LOGIN],
        }
      );
      render(<RouterProvider router={router} />);

      // AND expect the sensitive data form to be preloaded
      // We expect the lazyWithPreload to be called twice:
      // 1. Once for the ProtectedRoute
      // 2. Once for the Chat Component
      expect(lazyWithPreload).toHaveBeenCalledTimes(2);
      expect((lazyWithPreload as jest.Mock).mock.results[0].value.preload).toHaveBeenCalled();

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should not preload the sensitive data form if the user has no sensitive data available", async () => {
      // GIVEN the user has no sensitive data available
      getUserPreferences(new Date(), false, SensitivePersonalDataRequirement.NOT_AVAILABLE);
      // WHEN a component is rendered with the ProtectedRoute is rendered
      const router = createMemoryRouter(
        [
          {
            path: routerPaths.LOGIN,
            element: (
              <ProtectedRoute><div>Login</div></ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: [routerPaths.LOGIN],
        }
      );
      render(<RouterProvider router={router} />);

      // AND expect the sensitive data form to not be preloaded
      // We expect the lazyWithPreload to be called once for the Chat Component
      expect(lazyWithPreload).toHaveBeenCalledTimes(1);

      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
