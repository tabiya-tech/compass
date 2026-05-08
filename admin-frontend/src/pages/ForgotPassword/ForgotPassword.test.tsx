// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ForgotPassword, { DATA_TEST_ID } from "./ForgotPassword";
import { renderWithProviders } from "src/_test_utilities/renderWithProviders";

const mockResetPassword = jest.fn();
jest.mock("src/auth/services/FirebaseAuthenticationService/FirebaseEmailAuthenticationService", () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      resetPassword: (email: string) => mockResetPassword(email),
    }),
  },
}));

const renderPage = () => renderWithProviders(<ForgotPassword />);

describe("ForgotPassword page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows the neutral success view after a successful submission", async () => {
    // GIVEN Firebase resolves the password reset send successfully
    const givenEmail = "user@example.com";
    mockResetPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();

    // WHEN the user enters their email and submits
    renderPage();
    await user.type(screen.getByLabelText(/email/i), givenEmail);
    await user.click(screen.getByTestId(DATA_TEST_ID.FORGOT_PAGE_SUBMIT));

    // THEN the neutral success alert is shown
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.FORGOT_PAGE_SUCCESS)).toBeInTheDocument();
    });
    // AND the auth service was called with the trimmed email
    expect(mockResetPassword).toHaveBeenCalledWith(givenEmail);
  });

  test("shows the same neutral success view when Firebase reports user-not-found (anti-enumeration)", async () => {
    // GIVEN Firebase rejects with auth/user-not-found for an unknown email
    const givenEmail = "ghost@nowhere.io";
    mockResetPassword.mockRejectedValue(Object.assign(new Error("user not found"), { code: "auth/user-not-found" }));
    const user = userEvent.setup();

    // WHEN the user submits the unknown email
    renderPage();
    await user.type(screen.getByLabelText(/email/i), givenEmail);
    await user.click(screen.getByTestId(DATA_TEST_ID.FORGOT_PAGE_SUBMIT));

    // THEN the same neutral success alert is shown (no enumeration via UI)
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.FORGOT_PAGE_SUCCESS)).toBeInTheDocument();
    });
  });

  test("shows the same neutral success view on any other Firebase error", async () => {
    // GIVEN Firebase rejects with a network error
    const givenEmail = "user@example.com";
    mockResetPassword.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();

    // WHEN the user submits
    renderPage();
    await user.type(screen.getByLabelText(/email/i), givenEmail);
    await user.click(screen.getByTestId(DATA_TEST_ID.FORGOT_PAGE_SUBMIT));

    // THEN the same neutral success alert is shown
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.FORGOT_PAGE_SUCCESS)).toBeInTheDocument();
    });
  });

  test("disables submit when the email is empty", () => {
    // GIVEN no email entered
    // WHEN the page renders
    renderPage();

    // THEN the submit button is disabled
    expect(screen.getByTestId(DATA_TEST_ID.FORGOT_PAGE_SUBMIT)).toBeDisabled();
  });
});
