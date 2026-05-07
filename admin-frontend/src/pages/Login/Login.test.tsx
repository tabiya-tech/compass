// mute the console
import "src/_test_utilities/consoleMock";

const mockLogin = jest.fn();
jest.mock("src/auth/services/FirebaseAuthenticationService/FirebaseEmailAuthenticationService", () => ({
  __esModule: true,
  default: { getInstance: () => ({ login: mockLogin }) },
}));

import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Login, { DATA_TEST_ID } from "./Login";
import { FirebaseError } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import { registrationsService } from "src/pages/Register/registrationsService";
import { renderWithProviders } from "src/_test_utilities/renderWithProviders";

const mockEnqueue = jest.fn();
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueue, closeSnackbar: jest.fn() }),
}));

jest.mock("src/pages/Register/registrationsService", () => {
  const actual = jest.requireActual("src/pages/Register/registrationsService");
  return {
    ...actual,
    registrationsService: {
      submit: jest.fn(),
      getStatus: jest.fn(),
      list: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
    },
  };
});

const renderPage = () => renderWithProviders(<Login />);

const fillCredentialsAndSubmit = async (givenEmail: string, givenPassword: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), givenEmail);
  await user.type(screen.getByLabelText(/password/i), givenPassword);
  await user.click(screen.getByTestId(DATA_TEST_ID.LOGIN_PAGE_SUBMIT_BUTTON));
};

describe("Login page — pending-registration surfacing on auth failure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("surfaces a pending-approval message when the email matches a pending registration", async () => {
    // GIVEN Firebase returns USER_NOT_FOUND for the credentials
    mockLogin.mockRejectedValue(
      new FirebaseError(
        "FirebaseEmailAuthenticationService",
        "login",
        FirebaseErrorCodes.USER_NOT_FOUND,
        "user not found"
      )
    );
    // AND the registration status lookup says the email is pending
    (registrationsService.getStatus as jest.Mock).mockResolvedValue({
      email: "alice@school.edu",
      status: "pending",
    });

    // WHEN the user attempts to login
    renderPage();
    await fillCredentialsAndSubmit("alice@school.edu", "any-password");

    // THEN the pending-approval message is shown via snackbar
    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(
        "Your registration is still pending approval. You will receive an email once approved.",
        { variant: "info" }
      );
    });
    // AND the generic invalid-credentials message is NOT shown
    expect(mockEnqueue).not.toHaveBeenCalledWith("Invalid email or password", expect.anything());
  });

  test("falls back to the generic invalid-credentials message when no registration matches the email", async () => {
    // GIVEN Firebase returns INVALID_CREDENTIAL
    mockLogin.mockRejectedValue(
      new FirebaseError(
        "FirebaseEmailAuthenticationService",
        "login",
        FirebaseErrorCodes.INVALID_CREDENTIAL,
        "invalid credential"
      )
    );
    // AND the registration lookup returns null
    (registrationsService.getStatus as jest.Mock).mockResolvedValue({
      email: "stranger@nowhere.io",
      status: null,
    });

    // WHEN the user attempts to login
    renderPage();
    await fillCredentialsAndSubmit("stranger@nowhere.io", "any-password");

    // THEN the generic invalid-credentials message is shown
    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith("Invalid email or password", { variant: "error" });
    });
  });

  test("never blocks login on a registrations-status lookup failure", async () => {
    // GIVEN Firebase returns INVALID_CREDENTIAL
    mockLogin.mockReset();
    mockLogin.mockRejectedValue(
      new FirebaseError(
        "FirebaseEmailAuthenticationService",
        "login",
        FirebaseErrorCodes.INVALID_CREDENTIAL,
        "invalid credential"
      )
    );
    // AND the registration lookup throws
    (registrationsService.getStatus as jest.Mock).mockRejectedValue(new Error("rate limited"));

    // WHEN the user attempts to login
    renderPage();
    await fillCredentialsAndSubmit("anyone@example.com", "any-password");

    // THEN the generic invalid-credentials message is still shown
    await waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith("Invalid email or password", { variant: "error" });
    });
  });
});
