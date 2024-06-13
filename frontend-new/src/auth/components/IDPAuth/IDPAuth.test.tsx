import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor } from "src/_test_utilities/test-utils";
import IDPAuth from "./IDPAuth";
import * as firebaseui from "firebaseui";
import { HashRouter } from "react-router-dom";

// Mock the envService module
jest.mock("src/envService", () => ({
  getFirebaseAPIKey: jest.fn(() => "mock-api-key"),
  getFirebaseDomain: jest.fn(() => "mock-auth-domain"),
}));

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

jest.mock("firebase/compat/app", () => {
  return {
    initializeApp: jest.fn(),
    auth: {
      GoogleAuthProvider: { PROVIDER_ID: "google.com" },
    },
  };
});

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

describe("IDPAuth tests", () => {
  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();

    firebaseui.auth.AuthUI.getInstance = jest.fn();
  });

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
      expect(screen.getByText("Successfully signed in with google account!")).toBeInTheDocument();
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
      expect(screen.getByText("Sign-in failed")).toBeInTheDocument();
    });
  });
});
