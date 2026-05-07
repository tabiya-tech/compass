// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ForgotPassword, { DATA_TEST_ID } from "./ForgotPassword";
import { passwordResetService } from "./passwordResetService";
import { renderWithProviders } from "src/_test_utilities/renderWithProviders";

jest.mock("./passwordResetService", () => ({
  passwordResetService: {
    requestReset: jest.fn(),
  },
}));

const renderPage = () => renderWithProviders(<ForgotPassword />);

describe("ForgotPassword page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows the neutral success view after a successful submission", async () => {
    // GIVEN the password reset service resolves successfully
    const givenEmail = "user@example.com";
    (passwordResetService.requestReset as jest.Mock).mockResolvedValue(undefined);
    const user = userEvent.setup();

    // WHEN the user enters their email and submits
    renderPage();
    await user.type(screen.getByLabelText(/email/i), givenEmail);
    await user.click(screen.getByTestId(DATA_TEST_ID.FORGOT_PAGE_SUBMIT));

    // THEN the neutral success alert is shown
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.FORGOT_PAGE_SUCCESS)).toBeInTheDocument();
    });
    // AND the service was called with the trimmed email
    expect(passwordResetService.requestReset).toHaveBeenCalledWith(givenEmail);
  });

  test("shows the same neutral success view even when the backend errors", async () => {
    // GIVEN the password reset service rejects
    const givenEmail = "ghost@nowhere.io";
    (passwordResetService.requestReset as jest.Mock).mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();

    // WHEN the user enters their email and submits
    renderPage();
    await user.type(screen.getByLabelText(/email/i), givenEmail);
    await user.click(screen.getByTestId(DATA_TEST_ID.FORGOT_PAGE_SUBMIT));

    // THEN the same neutral success alert is shown (no enumeration via UI)
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
