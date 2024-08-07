import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { AuthContext, authContextDefaultValue } from "src/auth/AuthProvider";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import SocialAuth, { DATA_TEST_ID } from "./SocialAuth";
import { SocialAuthService } from "src/auth/services/socialAuth/SocialAuth.service";
import firebase from "firebase/compat/app";

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

describe("SocialAuth component tests", () => {
  const mockPostLoginHandler = jest.fn();
  const mockEnqueueSnackbar = jest.fn();
  const mockUpdateUserByToken = jest.fn();

  let socialAuthService: SocialAuthService;

  beforeEach(() => {
    socialAuthService = SocialAuthService.getInstance();
    jest.useFakeTimers(); // Use Jest's fake timers
    jest.clearAllMocks();

    // @ts-ignore
    firebase.auth.GoogleAuthProvider = { PROVIDER_ID: "google.com" };
  });

  beforeEach(() => {
    (useSnackbar as jest.Mock).mockReturnValue({ enqueueSnackbar: mockEnqueueSnackbar });
    // @ts-ignore
    jest.spyOn(socialAuthService, "initializeFirebaseUI").mockImplementation((_, successCallback, failureCallback) => {
      successCallback("mock-token");
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should render the SocialAuth component", () => {
    // GIVEN the component is rendered
    render(
      <AuthContext.Provider value={{ ...authContextDefaultValue, updateUserByToken: mockUpdateUserByToken }}>
        <IsOnlineContext.Provider value={true}>
          <SocialAuth postLoginHandler={mockPostLoginHandler} isLoading={false} />
        </IsOnlineContext.Provider>
      </AuthContext.Provider>
    );

    // THEN the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.FIREBASE_AUTH_CONTAINER)).toBeInTheDocument();
  });

  test("should show loading spinner when authentication is in progress", () => {
    // GIVEN the component is rendered with authentication in progress
    render(
      <AuthContext.Provider
        value={{
          ...authContextDefaultValue,
          isAuthenticationInProgress: true,
          updateUserByToken: mockUpdateUserByToken,
        }}
      >
        <IsOnlineContext.Provider value={true}>
          <SocialAuth postLoginHandler={mockPostLoginHandler} isLoading={false} />
        </IsOnlineContext.Provider>
      </AuthContext.Provider>
    );

    // THEN the loading spinner should be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FIREBASE_AUTH_LOADING)).toBeInTheDocument();
  });

  test("should show offline message when offline", () => {
    // GIVEN the component is rendered while offline
    render(
      <AuthContext.Provider value={{ ...authContextDefaultValue, updateUserByToken: mockUpdateUserByToken }}>
        <IsOnlineContext.Provider value={false}>
          <SocialAuth postLoginHandler={mockPostLoginHandler} isLoading={false} />
        </IsOnlineContext.Provider>
      </AuthContext.Provider>
    );

    // THEN the offline message should be displayed
    expect(screen.getByTestId(DATA_TEST_ID.FIREBASE_FALLBACK_TEXT)).toBeInTheDocument();
  });
});
