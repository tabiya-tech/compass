// standard sentry mock
import "src/_test_utilities/sentryMock";
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "src/_test_utilities/test-utils";
import AuthHandler, { DATA_TEST_ID } from "./AuthHandler";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";

// Mock the firebase compat module so we can intercept the action-handler SDK calls.
jest.mock("src/auth/firebaseConfig", () => ({
  __esModule: true,
  firebaseAuth: {
    applyActionCode: jest.fn(),
    verifyPasswordResetCode: jest.fn(),
    confirmPasswordReset: jest.fn(),
    checkActionCode: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  },
}));

// Mock the router so we can spy on navigation and inject a custom location.search.
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    __esModule: true,
    useNavigate: jest.fn().mockReturnValue(jest.fn()),
    useLocation: jest.fn(),
  };
});

// Mock the snackbar so our tests don't depend on the live provider.
const mockEnqueueSnackbar = jest.fn();
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar, closeSnackbar: jest.fn() }),
  };
});

const { firebaseAuth } = jest.requireMock("src/auth/firebaseConfig") as {
  firebaseAuth: {
    applyActionCode: jest.Mock;
    verifyPasswordResetCode: jest.Mock;
    confirmPasswordReset: jest.Mock;
    checkActionCode: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
  };
};

const { useLocation } = jest.requireMock("react-router-dom") as {
  useLocation: jest.Mock;
};

const setSearch = (search: string) => {
  useLocation.mockReturnValue({ pathname: routerPaths.AUTH_HANDLER, search, hash: "", state: null, key: "" });
};

describe("AuthHandler", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  describe("verifyEmail mode", () => {
    test("should apply the action code and redirect to login on success", async () => {
      // GIVEN a verifyEmail action link with a valid oobCode
      setSearch("?mode=verifyEmail&oobCode=valid-oob-code");
      // AND the firebase applyActionCode call resolves
      firebaseAuth.applyActionCode.mockResolvedValueOnce(undefined);
      const navigate = jest.fn();
      (useNavigate as jest.Mock).mockReturnValue(navigate);

      // WHEN the AuthHandler is rendered
      render(<AuthHandler />);

      // THEN expect applyActionCode to be called with the oobCode
      await waitFor(() => {
        expect(firebaseAuth.applyActionCode).toHaveBeenCalledWith("valid-oob-code");
      });

      // AND the success body should be visible
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.SUBTITLE)).toBeInTheDocument();
      });

      // AND after the redirect delay elapses, the user should be navigated to the login page
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(navigate).toHaveBeenCalledWith(routerPaths.LOGIN, { replace: true });
    });

    test("should show an error when applyActionCode rejects", async () => {
      // GIVEN a verifyEmail action link
      setSearch("?mode=verifyEmail&oobCode=expired-code");
      // AND firebase rejects with an expired action code
      firebaseAuth.applyActionCode.mockRejectedValueOnce({
        code: "auth/invalid-action-code",
        message: "expired",
      });

      // WHEN the AuthHandler is rendered
      render(<AuthHandler />);

      // THEN expect the back-to-login button to render in the error state
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.BACK_TO_LOGIN_BUTTON)).toBeInTheDocument();
      });
    });
  });

  describe("resetPassword mode", () => {
    test("should verify the reset code and render the password form", async () => {
      // GIVEN a resetPassword action link with a valid oobCode
      setSearch("?mode=resetPassword&oobCode=valid-reset-code");
      // AND verifyPasswordResetCode resolves with the account email
      firebaseAuth.verifyPasswordResetCode.mockResolvedValueOnce("user@example.com");

      // WHEN the AuthHandler is rendered
      render(<AuthHandler />);

      // THEN the reset form should appear with the new-password input
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.RESET_FORM)).toBeInTheDocument();
      });
      expect(firebaseAuth.verifyPasswordResetCode).toHaveBeenCalledWith("valid-reset-code");
    });

    test("should call confirmPasswordReset when a valid matching password is submitted", async () => {
      // GIVEN a resetPassword link and a verified code returning the email
      setSearch("?mode=resetPassword&oobCode=valid-reset-code");
      firebaseAuth.verifyPasswordResetCode.mockResolvedValueOnce("user@example.com");
      firebaseAuth.confirmPasswordReset.mockResolvedValueOnce(undefined);

      // WHEN the AuthHandler is rendered and the form is submitted with a strong matching password
      render(<AuthHandler />);
      await screen.findByTestId(DATA_TEST_ID.RESET_FORM);

      const newPasswordInput = screen.getByTestId(DATA_TEST_ID.NEW_PASSWORD_INPUT);
      const confirmPasswordInput = screen.getByTestId(DATA_TEST_ID.CONFIRM_PASSWORD_INPUT);
      const strongPassword = "Str0ng!Pass";
      fireEvent.change(newPasswordInput, { target: { value: strongPassword } });
      fireEvent.change(confirmPasswordInput, { target: { value: strongPassword } });

      const submit = screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON);
      await waitFor(() => expect(submit).not.toBeDisabled());
      fireEvent.click(submit);

      // THEN expect confirmPasswordReset to be called with the oobCode and the new password
      await waitFor(() => {
        expect(firebaseAuth.confirmPasswordReset).toHaveBeenCalledWith("valid-reset-code", strongPassword);
      });
    });

    test("should show an error when verifyPasswordResetCode rejects", async () => {
      // GIVEN a resetPassword link with an invalid code
      setSearch("?mode=resetPassword&oobCode=invalid-code");
      firebaseAuth.verifyPasswordResetCode.mockRejectedValueOnce({
        code: "auth/expired-action-code",
        message: "expired",
      });

      // WHEN the AuthHandler renders
      render(<AuthHandler />);

      // THEN the back-to-login error button should be rendered
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.BACK_TO_LOGIN_BUTTON)).toBeInTheDocument();
      });
      expect(screen.queryByTestId(DATA_TEST_ID.RESET_FORM)).not.toBeInTheDocument();
    });
  });

  describe("recoverEmail mode", () => {
    test("should restore the previous email and send a password reset email", async () => {
      // GIVEN a recoverEmail action link
      setSearch("?mode=recoverEmail&oobCode=recover-code");
      // AND checkActionCode returns the previous email
      firebaseAuth.checkActionCode.mockResolvedValueOnce({ data: { email: "old@example.com" } });
      firebaseAuth.applyActionCode.mockResolvedValueOnce(undefined);
      firebaseAuth.sendPasswordResetEmail.mockResolvedValueOnce(undefined);

      // WHEN the AuthHandler is rendered
      render(<AuthHandler />);

      // THEN we expect the action-code calls to be made in order
      await waitFor(() => {
        expect(firebaseAuth.checkActionCode).toHaveBeenCalledWith("recover-code");
      });
      await waitFor(() => {
        expect(firebaseAuth.applyActionCode).toHaveBeenCalledWith("recover-code");
      });
      await waitFor(() => {
        expect(firebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith("old@example.com");
      });

      // AND the back-to-login button should be visible in the success state
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.BACK_TO_LOGIN_BUTTON)).toBeInTheDocument();
      });
    });

    test("should still show success even if sending the password reset email fails", async () => {
      // GIVEN a recoverEmail link and checkActionCode succeeds, applyActionCode succeeds, but sendPasswordResetEmail fails
      setSearch("?mode=recoverEmail&oobCode=recover-code");
      firebaseAuth.checkActionCode.mockResolvedValueOnce({ data: { email: "old@example.com" } });
      firebaseAuth.applyActionCode.mockResolvedValueOnce(undefined);
      firebaseAuth.sendPasswordResetEmail.mockRejectedValueOnce({ code: "auth/internal-error", message: "boom" });

      // WHEN the AuthHandler renders
      render(<AuthHandler />);

      // THEN expect the success state still to be reached
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.BACK_TO_LOGIN_BUTTON)).toBeInTheDocument();
      });
    });
  });

  describe("invalid input", () => {
    test("should show an error when no mode is provided", async () => {
      // GIVEN an action link with no parameters
      setSearch("");

      // WHEN the AuthHandler is rendered
      render(<AuthHandler />);

      // THEN the error state should render with a back-to-login button
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.BACK_TO_LOGIN_BUTTON)).toBeInTheDocument();
      });
      // AND no firebase calls should have been made
      expect(firebaseAuth.applyActionCode).not.toHaveBeenCalled();
      expect(firebaseAuth.verifyPasswordResetCode).not.toHaveBeenCalled();
      expect(firebaseAuth.checkActionCode).not.toHaveBeenCalled();
    });

    test("should show an error when mode is unknown", async () => {
      // GIVEN an action link with an unrecognised mode
      setSearch("?mode=unknownMode&oobCode=foo");

      // WHEN the AuthHandler renders
      render(<AuthHandler />);

      // THEN the error state should render
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.BACK_TO_LOGIN_BUTTON)).toBeInTheDocument();
      });
    });

    test("should navigate back to login when the user clicks the back-to-login button", async () => {
      // GIVEN an invalid action link (so the error state renders)
      setSearch("");
      const navigate = jest.fn();
      (useNavigate as jest.Mock).mockReturnValue(navigate);

      // WHEN the AuthHandler renders and the user clicks the back-to-login button
      render(<AuthHandler />);
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.BACK_TO_LOGIN_BUTTON)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId(DATA_TEST_ID.BACK_TO_LOGIN_BUTTON));

      // THEN expect navigation to the login route
      expect(navigate).toHaveBeenCalledWith(routerPaths.LOGIN, { replace: true });
    });
  });
});
