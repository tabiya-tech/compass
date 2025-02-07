import "src/_test_utilities/consoleMock"
import React from "react";
import { render, screen, waitFor, act } from "src/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import ResendVerificationEmail, { DATA_TEST_ID, COOLDOWN_SECONDS } from "./ResendVerificationEmail";
import FirebaseEmailAuthService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";

// Mock the Firebase service
jest.mock("src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service", () => ({
  getInstance: jest.fn(),
}));

describe("ResendVerificationEmail", () => {
  // Common test data
  const mockEmail = "test@example.com";
  const mockPassword = "Test123!@#";
  const mockResendVerificationEmail = jest.fn();

  // Setup before each test
  beforeEach(() => {
    // Reset all mocks and timers
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });

    // Mock the Firebase service instance
    (FirebaseEmailAuthService.getInstance as jest.Mock).mockReturnValue({
      resendVerificationEmail: mockResendVerificationEmail,
    });

    // Mock the browser is online
    mockBrowserIsOnLine(true);
  });

  // Cleanup after each test
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test("should render the component with initial state", () => {
    // WHEN the component is rendered
    render(<ResendVerificationEmail email={mockEmail} password={mockPassword} />);

    // THEN the component should be visible with correct text
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toBeInTheDocument();
    expect(screen.getByText(/Your email is not verified/i)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.RESEND_LINK)).toHaveAttribute("aria-disabled", "false");
    expect(screen.queryByTestId(DATA_TEST_ID.TIMER)).not.toBeInTheDocument();
  });

  test("should handle successful resend verification email", async () => {
    // GIVEN the component is rendered and mock resolves successfully
    mockResendVerificationEmail.mockResolvedValueOnce(undefined);
    render(<ResendVerificationEmail email={mockEmail} password={mockPassword} />);
    const user = userEvent.setup({ delay: null });

    // WHEN the resend link is clicked
    const resendLink = screen.getByTestId(DATA_TEST_ID.RESEND_LINK);
    await user.click(resendLink);

    // THEN the service should be called with correct parameters
    expect(mockResendVerificationEmail).toHaveBeenCalledWith(mockEmail, mockPassword);

    // AND the success message should be shown
    await waitFor(() => {
      expect(screen.getByText(/Verification email sent successfully/i)).toBeInTheDocument();
    });

    // AND the button should be disabled with timer
    expect(resendLink).toHaveAttribute("aria-disabled", "true");

    // Run initial timer update
    await act(async () => {
      jest.advanceTimersByTime(0); // Advance by 0ms to process any pending state updates
    });

    // AND the timer should show the full cooldown time
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.TIMER)).toHaveTextContent(`(${COOLDOWN_SECONDS}s)`);
    });
  });

  test("should handle error when resending verification email", async () => {
    // GIVEN the service will fail
    const errorMessage = "Failed to send email";
    mockResendVerificationEmail.mockRejectedValueOnce(new Error(errorMessage));

    // WHEN the component is rendered
    render(<ResendVerificationEmail email={mockEmail} password={mockPassword} />);
    const user = userEvent.setup({ delay: null });
    const resendLink = screen.getByTestId(DATA_TEST_ID.RESEND_LINK);

    // AND the resend button is clicked
    await user.click(resendLink);

    // THEN the error message should be shown
    await waitFor(() => {
      expect(screen.getByText(new RegExp(errorMessage, "i"))).toBeInTheDocument();
    });

    // AND the button should be enabled without timer
    expect(resendLink).toHaveAttribute("aria-disabled", "false");
    expect(screen.queryByTestId(DATA_TEST_ID.TIMER)).not.toBeInTheDocument();
  });

  test("should update timer correctly", async () => {
    // GIVEN the component is rendered and mock resolves successfully
    mockResendVerificationEmail.mockResolvedValueOnce(undefined);
    render(<ResendVerificationEmail email={mockEmail} password={mockPassword} />);
    const user = userEvent.setup({ delay: null });
    const resendLink = screen.getByTestId(DATA_TEST_ID.RESEND_LINK);

    // WHEN the resend button is clicked
    await user.click(resendLink);

    // Run initial timer update
    await act(async () => {
      jest.advanceTimersByTime(0); // Advance by 0ms to process any pending state updates
    });

    // THEN the timer should start at the full cooldown time
    await waitFor(() => {
      const timerElement = screen.getByTestId(DATA_TEST_ID.TIMER);
      expect(timerElement).toHaveTextContent(`(${COOLDOWN_SECONDS}s)`);
    });

    // WHEN half the cooldown time passes
    const halfCooldown = COOLDOWN_SECONDS / 2;
    await act(async () => {
      jest.advanceTimersByTime(halfCooldown * 1000);
    });

    // THEN the timer should show half the time remaining
    await waitFor(() => {
      const timerElement = screen.getByTestId(DATA_TEST_ID.TIMER);
      expect(timerElement).toHaveTextContent(`(${halfCooldown}s)`);
    });

    // WHEN the remaining time passes
    await act(async () => {
      jest.advanceTimersByTime(halfCooldown * 1000);
    });

    // THEN the timer should disappear
    await waitFor(() => {
      expect(screen.queryByTestId(DATA_TEST_ID.TIMER)).not.toBeInTheDocument();
    });

    // AND the button should be enabled
    await waitFor(() => {
      expect(resendLink).toHaveAttribute("aria-disabled", "false");
    });
  });

  test("should disable the resend link when the browser is offline", async () => {
    // GIVEN the browser is offline
    mockBrowserIsOnLine(false);

    // WHEN the component is rendered
    render(<ResendVerificationEmail email={mockEmail} password={mockPassword} />);

    // THEN the resend link should be disabled
    const resendLink = screen.getByTestId(DATA_TEST_ID.RESEND_LINK);
    expect(resendLink).toHaveAttribute("aria-disabled", "true");

    // AND expect no errors or warnings to be logged
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should clear timer when component unmounts", async () => {
    // GIVEN the component is rendered and mock resolves successfully
    mockResendVerificationEmail.mockResolvedValueOnce(undefined);
    const { unmount } = render(<ResendVerificationEmail email={mockEmail} password={mockPassword} />);
    const user = userEvent.setup({ delay: null });
    const resendLink = screen.getByTestId(DATA_TEST_ID.RESEND_LINK);

    // WHEN the resend button is clicked
    await user.click(resendLink);

    // AND initial timer update runs
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    // AND the timer is confirmed to be running
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.TIMER)).toHaveTextContent(`(${COOLDOWN_SECONDS}s)`);
    });

    // WHEN the component is unmounted
    unmount();

    // AND time passes
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // THEN no timer updates should occur 
    // we would see an error about trying to update state on an unmounted component if the timer was not cleared
    expect(screen.queryByTestId(DATA_TEST_ID.TIMER)).not.toBeInTheDocument();

    // AND expect no errors or warnings to be logged
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
}); 