// mute the console
import "src/_test_utilities/consoleMock";

import React, { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";
import { routerPaths } from "src/app/routerPaths";
import { AdminUser } from "src/auth/auth.types";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import UserStateService from "src/userState/UserStateService";

/**
 * Helper function to mock the authenticated user state
 * @param user - The user to set as authenticated, or null for unauthenticated state
 */
const mockGetUser = (user: AdminUser | null) => {
  jest.spyOn(AuthenticationStateService.getInstance(), "getUser").mockReturnValue(user);
};

/**
 * Helper to reset all mocks on a singleton instance's methods
 */
const resetAllMethodMocks = (instance: object) => {
  const proto = Object.getPrototypeOf(instance);
  Object.getOwnPropertyNames(proto)
    .filter((prop) => prop !== "constructor" && typeof (instance as Record<string, unknown>)[prop] === "function")
    .forEach((methodName) => {
      const method = (instance as Record<string, jest.Mock>)[methodName];
      if (method && typeof method.mockReset === "function") {
        method.mockReset();
      }
    });
};

/**
 * Route configuration for the test router
 */
interface RouteConfig {
  path: string;
  element: ReactNode;
}

const renderWithRouter = (initialPath: string, routes: RouteConfig[]) => {
  const router = createMemoryRouter(
    routes.map((route) => ({
      path: route.path,
      element: <ProtectedRoute>{route.element}</ProtectedRoute>,
    })),
    {
      initialEntries: [initialPath],
    }
  );
  return render(<RouterProvider router={router} />);
};

describe("ProtectedRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all method mocks on the singletons to avoid side effects between tests
    resetAllMethodMocks(AuthenticationStateService.getInstance());
    resetAllMethodMocks(UserStateService.getInstance());
  });

  describe("login page behavior", () => {
    test("should show the login page when the user is not authenticated", () => {
      // GIVEN the user is not authenticated
      mockGetUser(null);

      // WHEN navigating to the login page
      renderWithRouter(routerPaths.LOGIN, [
        { path: routerPaths.LOGIN, element: <div>Login Page</div> },
        { path: routerPaths.ROOT, element: <div>Root Page</div> },
      ]);

      // THEN expect the login page to be displayed
      expect(screen.getByText("Login Page")).toBeInTheDocument();
      // AND expect the root page not to be displayed
      expect(screen.queryByText("Root Page")).not.toBeInTheDocument();
    });

    test("should redirect authenticated user from login page to root page", () => {
      // GIVEN the user is authenticated
      const givenUser: AdminUser = {
        id: "user-123",
        name: "John Doe",
        email: "john@example.com",
      };
      mockGetUser(givenUser);

      // WHEN navigating to the login page
      renderWithRouter(routerPaths.LOGIN, [
        { path: routerPaths.LOGIN, element: <div>Login Page</div> },
        { path: routerPaths.ROOT, element: <div>Root Page</div> },
      ]);

      // THEN expect the user to be redirected to the root page
      expect(screen.getByText("Root Page")).toBeInTheDocument();
      // AND expect the login page not to be displayed
      expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    });
  });

  describe("protected routes behavior", () => {
    test("should redirect unauthenticated user to login page when accessing protected route", () => {
      // GIVEN the user is not authenticated
      mockGetUser(null);

      // WHEN navigating to a protected route (root page)
      renderWithRouter(routerPaths.ROOT, [
        { path: routerPaths.ROOT, element: <div>Protected Content</div> },
        { path: routerPaths.LOGIN, element: <div>Login Page</div> },
      ]);

      // THEN expect the user to be redirected to the login page
      expect(screen.getByText("Login Page")).toBeInTheDocument();
      // AND expect the protected content not to be displayed
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    test("should allow authenticated user to access protected route", () => {
      // GIVEN the user is authenticated
      const givenUser: AdminUser = {
        id: "user-123",
        name: "Jane Doe",
        email: "jane@example.com",
      };
      mockGetUser(givenUser);

      // WHEN navigating to a protected route (root page)
      renderWithRouter(routerPaths.ROOT, [
        { path: routerPaths.ROOT, element: <div>Protected Content</div> },
        { path: routerPaths.LOGIN, element: <div>Login Page</div> },
      ]);

      // THEN expect the protected content to be displayed
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
      // AND expect the login page not to be displayed
      expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    });

    test("should redirect unauthenticated user from any path to login page", () => {
      // GIVEN the user is not authenticated
      mockGetUser(null);
      // AND a custom protected path
      const givenProtectedPath = "/users";

      // WHEN navigating to the custom protected path
      renderWithRouter(givenProtectedPath, [
        { path: givenProtectedPath, element: <div>Users Page</div> },
        { path: routerPaths.LOGIN, element: <div>Login Page</div> },
      ]);

      // THEN expect the user to be redirected to the login page
      expect(screen.getByText("Login Page")).toBeInTheDocument();
      // AND expect the protected page not to be displayed
      expect(screen.queryByText("Users Page")).not.toBeInTheDocument();
    });
  });

  describe("users page admin gating", () => {
    const givenUser: AdminUser = {
      id: "user-123",
      name: "John Doe",
      email: "john@example.com",
    };

    test("should allow admin to access the users page", () => {
      // GIVEN the user is authenticated AND is an admin
      mockGetUser(givenUser);
      jest.spyOn(UserStateService.getInstance(), "isAdmin").mockReturnValue(true);
      jest.spyOn(UserStateService.getInstance(), "isInstitutionStaff").mockReturnValue(false);

      // WHEN navigating to the users page
      renderWithRouter(routerPaths.USERS, [
        { path: routerPaths.USERS, element: <div>Users Page</div> },
        { path: routerPaths.INSTRUCTOR, element: <div>Instructor Page</div> },
        { path: routerPaths.ROOT, element: <div>Root Page</div> },
      ]);

      // THEN expect the users page to be displayed
      expect(screen.getByText("Users Page")).toBeInTheDocument();
    });

    test("should redirect institution staff from the users page to the instructor dashboard", () => {
      // GIVEN the user is authenticated AND is institution staff (not admin)
      mockGetUser(givenUser);
      jest.spyOn(UserStateService.getInstance(), "isAdmin").mockReturnValue(false);
      jest.spyOn(UserStateService.getInstance(), "isInstitutionStaff").mockReturnValue(true);

      // WHEN navigating to the users page
      renderWithRouter(routerPaths.USERS, [
        { path: routerPaths.USERS, element: <div>Users Page</div> },
        { path: routerPaths.INSTRUCTOR, element: <div>Instructor Page</div> },
        { path: routerPaths.ROOT, element: <div>Root Page</div> },
      ]);

      // THEN expect the instructor page to be displayed
      expect(screen.getByText("Instructor Page")).toBeInTheDocument();
      // AND expect the users page not to be displayed
      expect(screen.queryByText("Users Page")).not.toBeInTheDocument();
    });

    test("should redirect a non-admin, non-staff user from the users page to the root page", () => {
      // GIVEN the user is authenticated but has neither admin nor institution staff role
      mockGetUser(givenUser);
      jest.spyOn(UserStateService.getInstance(), "isAdmin").mockReturnValue(false);
      jest.spyOn(UserStateService.getInstance(), "isInstitutionStaff").mockReturnValue(false);

      // WHEN navigating to the users page
      renderWithRouter(routerPaths.USERS, [
        { path: routerPaths.USERS, element: <div>Users Page</div> },
        { path: routerPaths.INSTRUCTOR, element: <div>Instructor Page</div> },
        { path: routerPaths.ROOT, element: <div>Root Page</div> },
      ]);

      // THEN expect the root page to be displayed
      expect(screen.getByText("Root Page")).toBeInTheDocument();
      // AND expect the users page not to be displayed
      expect(screen.queryByText("Users Page")).not.toBeInTheDocument();
    });
  });

  describe("children rendering", () => {
    test("should render children when user is authenticated on protected route", () => {
      // GIVEN the user is authenticated
      const givenUser: AdminUser = {
        id: "user-456",
        name: "Test User",
        email: "test@example.com",
      };
      mockGetUser(givenUser);

      // WHEN rendering protected route with children
      renderWithRouter(routerPaths.ROOT, [
        { path: routerPaths.ROOT, element: <div data-testid="child-content">Child Component Content</div> },
      ]);

      // THEN expect the children to be rendered
      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(screen.getByText("Child Component Content")).toBeInTheDocument();
    });

    test("should render children when user is not authenticated on login page", () => {
      // GIVEN the user is not authenticated
      mockGetUser(null);

      // WHEN rendering the login page with children
      renderWithRouter(routerPaths.LOGIN, [
        { path: routerPaths.LOGIN, element: <div data-testid="login-form">Login Form Content</div> },
      ]);

      // THEN expect the children to be rendered
      expect(screen.getByTestId("login-form")).toBeInTheDocument();
      expect(screen.getByText("Login Form Content")).toBeInTheDocument();
    });
  });
});
