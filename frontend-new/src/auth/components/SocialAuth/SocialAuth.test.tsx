import "src/_test_utilities/consoleMock";
import React from "react";
import { render, waitFor, screen } from "src/_test_utilities/test-utils";
import SocialAuth, { DATA_TEST_ID } from "./SocialAuth";
import { HashRouter } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { mockBrowserIsOnLine, unmockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { socialAuthService } from "src/auth/services/socialAuth/SocialAuth.service";
import { act } from "@testing-library/react";
import authStateService from "../../AuthStateService";

// Mock the envService module
jest.mock("src/envService", () => ({
  getFirebaseAPIKey: jest.fn(() => "mock-api-key"),
  getFirebaseDomain: jest.fn(() => "mock-auth-domain"),
  getBackendUrl: jest.fn(() => "mock-backend-url"),
}));

// Mock the socialAuthService module
jest.mock("src/auth/services/socialAuth/SocialAuth.service", () => ({
  socialAuthService: {
    handleLoginWithGoogle: jest.fn(),
    initializeFirebaseUI: jest.fn(),
  },
}));

// Mock the snackbar provider
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

// Mock the router
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

describe("SocialAuth tests", () => {
  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    unmockBrowserIsOnLine();
  });

  test("should render the SocialAuth component", () => {
    // GIVEN a SocialAuth component
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoading = false;
    // WHEN the component is rendered
    render(
      <HashRouter>
        <SocialAuth postLoginHandler={givenNotifyOnLogin} isLoading={givenIsLoading} />
      </HashRouter>
    );

    // THEN expect the component to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON)).toBeInTheDocument();
  });

  test.each([
    ["accepted", new Date(), routerPaths.ROOT],
    ["not accepted", undefined, routerPaths.DPA],
  ])(
    "it should handle successful sign-in for a user who has %s terms and conditions",
    async (_description: string, tc: Date | undefined, expectedPath: string) => {
      // GIVEN a SocialAuth component
      const givenNotifyOnLogin = jest.fn();
      const givenIsLoading = false;
      const givenToken = "mock-token";
      const givenUser = {
        id: "mock-id",
        name: "foo bar",
        email: "foo@bar.baz",
      };
      // AND the sign-in is successful
      (socialAuthService.handleLoginWithGoogle as jest.Mock).mockResolvedValue(givenToken);
      // AND the AuthProvider updates the user successully
      jest.spyOn(authStateService, "updateUserByToken").mockImplementation((token: string) => {
        return givenUser;
      });

      // WHEN the component is rendered
      render(
        <HashRouter>
          <SocialAuth preLoginCheck={() => true} postLoginHandler={givenNotifyOnLogin} isLoading={givenIsLoading} />
        </HashRouter>
      );
      // AND the login button is clicked
      const loginButton = screen.getByTestId(DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON);
      await act(() => {
        loginButton.click();
      });

      // THEN expect the user to be redirected to the correct path
      await waitFor(() => {
        expect(givenNotifyOnLogin).toHaveBeenCalledWith(givenUser);
      });
    }
  );

  test("should handle sign-in failure", async () => {
    // GIVEN a SocialAuth component
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoading = false;
    // WHEN the sign-in fails
    (socialAuthService.handleLoginWithGoogle as jest.Mock).mockImplementation((elementId: string, config: any) => {
      config.callbacks.signInFailure(new Error("Sign-in failed"));
    });

    render(
      <HashRouter>
        <SocialAuth postLoginHandler={givenNotifyOnLogin} isLoading={givenIsLoading} />
      </HashRouter>
    );
  });

  test("should show message if browser is not online", () => {
    // GIVEN a SocialAuth component
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoading = false;
    // AND the browser is not online
    mockBrowserIsOnLine(false);
    // WHEN the component is rendered
    render(
      <HashRouter>
        <SocialAuth postLoginHandler={givenNotifyOnLogin} isLoading={givenIsLoading} />
      </HashRouter>
    );

    // THEN expect the message text to be in the document
    expect(screen.getByTestId(DATA_TEST_ID.FIREBASE_FALLBACK_TEXT)).toBeInTheDocument();
  });
});
