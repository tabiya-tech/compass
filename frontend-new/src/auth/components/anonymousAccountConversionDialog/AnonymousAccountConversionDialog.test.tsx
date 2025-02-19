// silence chatty console logs
import "src/_test_utilities/consoleMock";
import { render, screen, within, act } from "src/_test_utilities/test-utils";
import userEvent from "@testing-library/user-event";
import AnonymousAccountConversionDialog, { DATA_TEST_ID } from "./AnonymousAccountConversionDialog";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import FirebaseEmailAuthenticationService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import PasswordInput from "src/theme/PasswordInput/PasswordInput";
import React from "react";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";

jest.mock("src/app/PersistentStorageService/PersistentStorageService");
jest.mock("src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service");
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


// mock the password input
jest.mock("src/theme/PasswordInput/PasswordInput", () => {
  const actual = jest.requireActual("src/theme/PasswordInput/PasswordInput");
  return {
    __esModule: true,
    ...actual,
    default: jest.fn().mockImplementation((props) => {
      return <input data-testid={actual.DATA_TEST_ID.TEXT_FIELD_INPUT} {...props} />;
    }),
  };
});

const mockPersistentStorageService = PersistentStorageService as jest.Mocked<typeof PersistentStorageService>;
const mockFirebaseEmailAuthService = {
  linkAnonymousAccount: jest.fn(),
};

describe("AnonymousAccountConversionDialog", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (FirebaseEmailAuthenticationService.getInstance as jest.Mock).mockReturnValue(mockFirebaseEmailAuthService);
  });

  test("should prefill email field with stored email from PersistentStorageService", () => {
    // GIVEN a stored email
    const storedEmail = "test@example.com";
    mockPersistentStorageService.getPersonalInfo.mockReturnValue({
      fullName: "",
      phoneNumber: "",
      contactEmail: storedEmail,
      address: "",
    });

    // WHEN the dialog is rendered
    render(
      <AnonymousAccountConversionDialog {...defaultProps} />
    );

    // THEN the email field should be prefilled with the stored email
    const emailContainer = screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT);
    const emailInput = within(emailContainer).getByRole('textbox');
    expect(emailInput).toHaveValue(storedEmail);
  });

  test("should not prefill email field when no email is stored", () => {
    // GIVEN no email is stored
    mockPersistentStorageService.getPersonalInfo.mockReturnValue(null);

    // WHEN the dialog is rendered
    render(
      <AnonymousAccountConversionDialog {...defaultProps} />
    );

    // THEN the email field should be empty
    const emailContainer = screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT);
    const emailInput = within(emailContainer).getByRole('textbox');
    expect(emailInput).toHaveValue("");

    // AND no errors or warnings are shown
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should successfully submit form with valid data", async () => {
    // GIVEN  an email and password
    const givenEmail = "test@example.com";
    const givenPassword = "Password123$";
    mockFirebaseEmailAuthService.linkAnonymousAccount.mockResolvedValue("success");

    // WHEN the dialog is rendered
    render(
      <AnonymousAccountConversionDialog {...defaultProps} />
    );

    // AND valid form data is entered
    const emailContainer = screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT);
    const emailInput = within(emailContainer).getByRole('textbox');
    const emailConfirmContainer = screen.getByTestId(DATA_TEST_ID.EMAIL_CONFIRMATION_INPUT);
    const emailConfirmInput = within(emailConfirmContainer).getByRole('textbox');

    await userEvent.type(emailInput, givenEmail);
    await userEvent.type(emailConfirmInput, givenEmail);

    act(() => {
      (PasswordInput as jest.Mock).mock.calls[0][0].onChange({ target: { value: givenPassword } });
      (PasswordInput as jest.Mock).mock.calls[0][0].onValidityChange(true);
    })

    // Wait for validation to complete
    const submitButton = screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON);
    expect(submitButton).not.toBeDisabled();

    // AND the form is submitted
    await userEvent.click(submitButton);

    // THEN the service should be called with correct data
    expect(mockFirebaseEmailAuthService.linkAnonymousAccount).toHaveBeenCalledWith(givenEmail, givenPassword, givenEmail);

    // AND the snackbar should show two messages
    expect(useSnackbar().enqueueSnackbar).toHaveBeenNthCalledWith(1, "Account successfully registered!", { variant: "success" });
    expect(useSnackbar().enqueueSnackbar).toHaveBeenNthCalledWith(2, `Currently logged in with the email: ${givenEmail}. A verification email has been sent to your email address. Please verify your account before logging in again.`, {
      variant: "info",
      persist: true,
      autoHideDuration: null
    })

    // AND success callbacks should be triggered
    expect(defaultProps.onSuccess).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();

    // AND no errors or warnings are shown
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should show error message when service call fails", async () => {
    // GIVEN an email and password
    const givenEmail = "test@example.com";
    const givenPassword = "Password123$";
    const errorMessage = "Registration failed";
    mockFirebaseEmailAuthService.linkAnonymousAccount.mockRejectedValue(new Error(errorMessage));

    // WHEN the dialog is rendered
    render(
      <AnonymousAccountConversionDialog {...defaultProps} />
    );

    // AND valid form data is entered
    const emailContainer = screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT);
    const emailInput = within(emailContainer).getByRole('textbox');
    const emailConfirmContainer = screen.getByTestId(DATA_TEST_ID.EMAIL_CONFIRMATION_INPUT);
    const emailConfirmInput = within(emailConfirmContainer).getByRole('textbox');

    await userEvent.type(emailInput, givenEmail);
    await userEvent.type(emailConfirmInput, givenEmail);

    act(() => {
      (PasswordInput as jest.Mock).mock.calls[0][0].onChange({ target: { value: givenPassword } });
      (PasswordInput as jest.Mock).mock.calls[0][0].onValidityChange(true);
    })

    // Wait for validation to complete
    const submitButton = screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON);
    expect(submitButton).not.toBeDisabled();

    // AND the form is submitted
    await userEvent.click(submitButton);

    // THEN an error message should be shown
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(errorMessage, { variant: "error" })

    // AND the callbacks should not be called
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    expect(defaultProps.onClose).not.toHaveBeenCalled();

    // AND no errors or warnings are shown
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test("should disable submit when password is invalid", () => {
    // WHEN the dialog is rendered
    render(<AnonymousAccountConversionDialog {...defaultProps} />);

    // AND the password input is invalid
    (PasswordInput as jest.Mock).mock.calls[0][0].onValidityChange(false);

    // THEN the submit button should be disabled
    const submitButton = screen.getByTestId(DATA_TEST_ID.SUBMIT_BUTTON);
    expect(submitButton).toBeDisabled();

    // AND no errors or warnings are shown
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
  
}); 
