// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { AuthContext } from "src/auth/AuthProvider/AuthProvider";
import { routerPaths } from "src/app/routerPaths";
import { TestUser } from "src/_test_utilities/mockLoggedInUser";

describe("ProtectedRoute test", () => {
  const authContextValue = {
    loginWithEmail: jest.fn(),
    isLoggingInWithEmail: false,
    isRegisteringWithEmail: false,
    isLoggingInAnonymously: false,
    isLoggingOut: false,
    user: null,
    registerWithEmail: jest.fn(),
    logout: jest.fn(),
    handlePageLoad: jest.fn(),
    loginAnonymously: jest.fn(),
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
      <AuthContext.Provider value={{ ...authContextValue, user: TestUser }}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    );

    // THEN expect the user to be redirected to the root page
    expect(screen.queryByText("Unprotected component")).not.toBeInTheDocument();
  });
});
