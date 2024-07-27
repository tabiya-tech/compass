import "src/_test_utilities/consoleMock";
import React from "react";
import { render, waitFor, screen } from "src/_test_utilities/test-utils";
import IDPAuth, { DATA_TEST_ID } from "./IDPAuth";
import * as firebaseui from "firebaseui";
import { HashRouter } from "react-router-dom";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { routerPaths } from "src/app/routerPaths";
import { mockUseTokens } from "src/_test_utilities/mockUseTokens";
import { mockBrowserIsOnLine, unmockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";

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
        getInstance: jest.fn().mockReturnValue({
          reset: jest.fn(),
        }),
        reset: jest.fn(),
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

  beforeEach(() => {
    unmockBrowserIsOnLine();
  });

  test("should render the IDPAuth component", () => {
    // GIVEN a IDPAuth component
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoading = false;
    // WHEN the component is rendered
    render(
      <HashRouter>
        <IDPAuth notifyOnLogin={givenNotifyOnLogin} isLoading={givenIsLoading} />
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
      const givenNotifyOnLogin = jest.fn();
      const givenIsLoading = false;
      const givenUser = {
        id: "mock-id",
        name: "foo bar",
        email: "foo@bar.baz",
      };
      // AND the sign-in is successful
      (firebaseui.auth.AuthUI as unknown as jest.Mock).mockImplementation(() => ({
        start: (elementId: string, config: any) => {
          config.callbacks.signInSuccessWithAuthResult({
            user: {
              uid: givenUser.id,
              displayName: givenUser.name,
              email: givenUser.email,
              multiFactor: { user: { accessToken: "mock-access-token" } },
            },
            credential: {
              idToken: "mock-id-token",
            },
          });
        },
        reset: jest.fn(),
      }));

      // WHEN the component is rendered
      render(
        <HashRouter>
          <IDPAuth notifyOnLogin={givenNotifyOnLogin} isLoading={givenIsLoading} />
        </HashRouter>
      );

      // THEN expect the user to be redirected to the correct path
      await waitFor(() => {
        expect(givenNotifyOnLogin).toHaveBeenCalledWith(givenUser);
      });

      // AND a success message to be shown
      await waitFor(() => {
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Login successful", { variant: "success" });
      });
    }
  );

  test("should handle sign-in failure", async () => {
    // GIVEN a IDPAuth component
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoading = false;
    // WHEN the sign-in fails
    (firebaseui.auth.AuthUI as unknown as jest.Mock).mockImplementation(() => ({
      start: (elementId: string, config: any) => {
        config.callbacks.signInFailure({ message: "Sign-in failed" });
      },
      reset: jest.fn(),
    }));

    render(
      <HashRouter>
        <IDPAuth notifyOnLogin={givenNotifyOnLogin} isLoading={givenIsLoading} />
      </HashRouter>
    );

    // THEN expect error message to be in the document
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Login failed", { variant: "error" });
    });
  });

  test("should show message if browser is not online", () => {
    // GIVEN a IDPAuth component
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoading = false;
    // AND the browser is not online
    mockBrowserIsOnLine(false);
    // WHEN the component is rendered
    render(
      <HashRouter>
        <IDPAuth notifyOnLogin={givenNotifyOnLogin} isLoading={givenIsLoading} />
      </HashRouter>
    );

    // THEN expect the message text to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FIREBASE_FALLBACK_TEXT)).toBeInTheDocument();
  });
});
