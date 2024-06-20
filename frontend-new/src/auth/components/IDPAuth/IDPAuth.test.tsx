import "src/_test_utilities/consoleMock";
import React from "react";
import { render, waitFor } from "src/_test_utilities/test-utils";
import IDPAuth from "./IDPAuth";
import * as firebaseui from "firebaseui";
import { HashRouter, useNavigate } from "react-router-dom";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { routerPaths } from "src/app/routerPaths";
import UserPreferencesService from "src/auth/services/UserPreferences/userPreferences.service";
import { mockUseTokens } from "src/_test_utilities/mockUseTokens";

// Mock the envService module
jest.mock("src/envService", () => ({
  getFirebaseAPIKey: jest.fn(() => "mock-api-key"),
  getFirebaseDomain: jest.fn(() => "mock-auth-domain"),
  getBackendUrl: jest.fn(() => "mock-backend-url"),
}));

// mock the firebaseConfig module
jest.mock("src/auth/firebaseConfig", () => {
  const auth = jest.fn(() => ({
    signInWithCustomToken: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    GoogleAuthProvider: { PROVIDER_ID: "google.com" },
  }));
  return {
    auth,
  };
});

// mock the firebase module
jest.mock("firebase/compat/app", () => {
  return {
    initializeApp: jest.fn(),
    auth: {
      GoogleAuthProvider: { PROVIDER_ID: "google.com" },
    },
  };
});

// mock the firebaseui module
jest.mock("firebaseui", () => {
  return {
    auth: {
      AuthUI: jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        getInstance: jest.fn(),
      })),
    },
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

// mock the UserPreferencesService
jest.mock("src/auth/services/UserPreferences/userPreferences.service", () => {
  return jest.fn().mockImplementation(() => {
    return {
      getUserPreferences: jest.fn(),
    };
  });
});

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

describe("IDPAuth tests", () => {
  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();

    firebaseui.auth.AuthUI.getInstance = jest.fn();
  });

  beforeAll(() => mockUseTokens());
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should render the IDPAuth component", () => {
    // GIVEN a IDPAuth component
    // WHEN the component is rendered
    render(
      <HashRouter>
        <IDPAuth />
      </HashRouter>
    );

    // THEN expect the component to be in the document
    expect(document.getElementById("firebaseui-auth-container")).toBeInTheDocument();
  });

  test.each([
    ["accepted", new Date(), routerPaths.ROOT],
    ["not accepted", undefined, routerPaths.DPA],
  ])(
    "it should handle successful sign-in for a user who has %s terms and conditions",
    async (_description: string, tc: Date | undefined, expectedPath: string) => {
      // GIVEN a IDPAuth component
      // AND the sign-in is successful
      (firebaseui.auth.AuthUI as unknown as jest.Mock).mockImplementation(() => ({
        start: (elementId: string, config: any) => {
          config.callbacks.signInSuccessWithAuthResult({
            user: { id: "mock-id" },
            credential: {
              idToken: "mock-id-token",
            },
          });
        },
      }));

      // AND the user preferences service will return a user who has either accepted or not accepted terms and conditions
      const userPreferencesServiceMock = {
        getUserPreferences: jest.fn().mockResolvedValue({ accepted_tc: tc }),
      };
      (UserPreferencesService as jest.Mock).mockImplementation(() => userPreferencesServiceMock);

      // WHEN the component is rendered
      render(
        <HashRouter>
          <IDPAuth />
        </HashRouter>
      );

      // THEN expect the user to be redirected to the correct path
      await waitFor(() => {
        expect(useNavigate()).toHaveBeenCalledWith(expectedPath, { replace: true });
      });

      // AND a success message to be shown
      await waitFor(() => {
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Login successful", { variant: "success" });
      });
    }
  );

  test("it should show an error message if the user preferences cannot be fetched", async () => {
    // GIVEN a IDPAuth component
    // AND the sign-in is successful
    (firebaseui.auth.AuthUI as unknown as jest.Mock).mockImplementation(() => ({
      start: (elementId: string, config: any) => {
        config.callbacks.signInSuccessWithAuthResult({
          user: { id: "mock-id" },
          credential: {
            idToken: "mock-id-token",
          },
        });
      },
    }));
    // AND the user preferences service will fail
    const userPreferencesServiceMock = {
      getUserPreferences: jest.fn().mockRejectedValue(new Error("Failed to fetch user preferences")),
    };
    (UserPreferencesService as jest.Mock).mockImplementation(() => userPreferencesServiceMock);

    // WHEN the component is rendered
    render(
      <HashRouter>
        <IDPAuth />
      </HashRouter>
    );

    // THEN expect an error message to be shown
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to fetch user preferences", {
        variant: "error",
      });
    });
  });

  test("should handle sign-in failure", async () => {
    // GIVEN a IDPAuth component
    // WHEN the sign-in fails
    (firebaseui.auth.AuthUI as unknown as jest.Mock).mockImplementation(() => ({
      start: (elementId: string, config: any) => {
        config.callbacks.signInFailure({ message: "Sign-in failed" });
      },
    }));

    render(
      <HashRouter>
        <IDPAuth />
      </HashRouter>
    );

    // THEN expect error message to be in the document
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Login failed", { variant: "error" });
    });
  });
});

/*
 test("should handle successful sign-in", async () => {
    // GIVEN a IDPAuth component
    // WHEN the sign-in is successful
    (firebaseui.auth.AuthUI as unknown as jest.Mock).mockImplementation(() => ({
      start: (elementId: string, config: any) => {
        config.callbacks.signInSuccessWithAuthResult({});
      },
    }));

    render(
      <HashRouter>
        <IDPAuth />
      </HashRouter>
    );

    // THEN expect success message to be in the document
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Login successful", { variant: "success" });
    });
  });
 */
