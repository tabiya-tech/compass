import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "src/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import PasswordReset, { DATA_TEST_ID } from "./PasswordReset";
import FirebaseEmailAuthService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";

// Mock Firebase service
jest.mock("src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service", () => ({
  getInstance: jest.fn(),
}));

describe("ResetPasswordEmailSender", () => {
  const mockResetPassword = jest.fn();

  beforeEach(() => {
    // GIVEN mocks are reset
    jest.clearAllMocks();

    // AND Firebase service is mocked
    (FirebaseEmailAuthService.getInstance as jest.Mock).mockReturnValue({
      resetPassword: mockResetPassword,
    });

    // AND browser is online
    mockBrowserIsOnLine(true);
  });

  afterEach(() => {
    // Always restore real timers after each test
    jest.useRealTimers();
  });

  test("should render the component with initial state", () => {
    // WHEN the component is rendered
    render(<PasswordReset />);

    // THEN the reset link and container should be present
    expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.RESET_LINK)).toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.TIMER)).not.toBeInTheDocument();
  });

  test("should open modal and send reset email successfully", async () => {
    // GIVEN Firebase resetPassword resolves
    mockResetPassword.mockResolvedValueOnce(undefined);
    render(<PasswordReset />);
    const user = userEvent.setup();

    // WHEN user clicks the reset link and enters an email
    await user.click(screen.getByTestId(DATA_TEST_ID.RESET_LINK));
    const inputWrapper = screen.getByTestId(DATA_TEST_ID.INPUT);
    const input = within(inputWrapper).getByRole('textbox');
    fireEvent.change(input, { target: { value: "test@example.com" } });
    
    await user.click(screen.getByTestId(DATA_TEST_ID.SUBMIT));

    // THEN the service should be called
    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith("test@example.com");
    });
    
    // AND modal should close
    await waitFor(() => {
      expect(screen.queryByTestId(DATA_TEST_ID.DIALOG)).not.toBeInTheDocument();
    });
  });

  test("should handle error when sending reset email", async () => {
    // GIVEN Firebase resetPassword rejects
    const errorMessage = "Reset failed";
    mockResetPassword.mockRejectedValueOnce(new Error(errorMessage));
    render(<PasswordReset />);
    const user = userEvent.setup();

    // WHEN submitting the form
    await user.click(screen.getByTestId(DATA_TEST_ID.RESET_LINK));
    const inputWrapper = screen.getByTestId(DATA_TEST_ID.INPUT);
    const input = within(inputWrapper).getByRole('textbox');
    fireEvent.change(input, { target: { value: "fail@example.com" } });
    
    await user.click(screen.getByTestId(DATA_TEST_ID.SUBMIT));

    // THEN the modal should close
    await waitFor(() => {
      expect(screen.queryByTestId(DATA_TEST_ID.DIALOG)).not.toBeInTheDocument();
    });
  });

  test("should disable the link when offline", () => {
    // GIVEN browser is offline
    mockBrowserIsOnLine(false);

    // WHEN component is rendered
    render(<PasswordReset />);

    // THEN reset link should be disabled
    expect(screen.getByTestId(DATA_TEST_ID.RESET_LINK)).toHaveAttribute("aria-disabled", "true");
  });

  test("should close dialog on cancel", async () => {
    // GIVEN the modal is open
    render(<PasswordReset />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId(DATA_TEST_ID.RESET_LINK));

    // WHEN user clicks close icon
    await user.click(screen.getByTestId(DATA_TEST_ID.CLOSE_ICON));

    // THEN modal should close
    await waitFor(() => {
      expect(screen.queryByTestId(DATA_TEST_ID.DIALOG)).not.toBeInTheDocument();
    });
  });
});
