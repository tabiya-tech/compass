// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { routerPaths } from "src/app/routerPaths";
import { AuthContext, AuthContextValue } from "src/auth/AuthProvider";

// mock the SocialAuthService
jest.mock("src/auth/services/socialAuth/SocialAuth.service", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        logout: jest.fn(),
      };
    }),
  };
});

describe("ProtectedRoute test", () => {
  const authContextValue: AuthContextValue = {
    user: null,
    updateUserByToken: jest.fn(),
    clearUser: jest.fn(),
    isAuthenticationInProgress: false,
    isAuthenticated: false,
  };

  test("should redirect to the login page if the user is not logged in and authentication is required", () => {
    // GIVEN the user select a page that require authentication
    const router = createMemoryRouter([
      {
        path: routerPaths.ROOT,
        element: (
          <ProtectedRoute authenticationAndDPARequired={true}>
            <div>Protected page</div>
          </ProtectedRoute>
        ),
      },
    ]);

    // WHEN the user navigates to the page
    render(
      <AuthContext.Provider value={authContextValue}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    );

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
          <ProtectedRoute authenticationAndDPARequired={false}>
            <div>Unprotected page</div>
          </ProtectedRoute>
        ),
      },
    ]);

    // WHEN the user navigates to the page
    render(
      <AuthContext.Provider
        value={{
          ...authContextValue,
          user: {
            id: "0001",
            name: "Test User",
            email: "test@email.com",
          },
        }}
      >
        <RouterProvider router={router} />
      </AuthContext.Provider>
    );

    // THEN expect the user to be redirected to the root page
    expect(screen.queryByText("Unprotected component")).not.toBeInTheDocument();
  });
});
