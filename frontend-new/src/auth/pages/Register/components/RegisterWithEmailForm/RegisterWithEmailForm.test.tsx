// silence chatty console
import "src/_test_utilities/consoleMock";
import RegisterWithEmailForm, { DATA_TEST_ID } from "./RegisterWithEmailForm";
import React from "react";
import { render, screen, fireEvent, act } from "src/_test_utilities/test-utils";
import PasswordInput, { DATA_TEST_ID as PASSWORD_INPUT_DATA_TEST_ID } from "src/theme/PasswordInput/PasswordInput";

// mock the SocialAuthService
jest.mock("src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        logout: jest.fn(),
      };
    }),
  };
});

// mock the password validator
jest.mock("src/theme/PasswordInput/utils/validatePassword", () => {
  return {
    __esModule: true,
    validatePassword: jest.fn().mockReturnValue(""),
  };
});

// mock the password input
jest.mock("src/theme/PasswordInput/PasswordInput", () => {
  const actual = jest.requireActual("src/theme/PasswordInput/PasswordInput");
  return {
    __esModule: true,
    ...actual,
    default: jest.fn().mockImplementation(() => {
      return <div data-testid={actual.DATA_TEST_ID.TEXT_FIELD} />;
    }),
  };
});

describe("Testing Register Email Form component", () => {
  beforeEach(() => {
    // Clear console mocks and mock functions
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  // GIVEN some props
  const givenNotifyOnRegister = jest.fn();
  const givenIsRegistering = false;

  test("it should show register form", async () => {
    // WHEN the component is rendered
    render(<RegisterWithEmailForm notifyOnRegister={givenNotifyOnRegister} isRegistering={givenIsRegistering} />);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.FORM)).toBeDefined();

    // AND the email input should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeInTheDocument();

    // AND the password input should be rendered
    expect(screen.getByTestId(PASSWORD_INPUT_DATA_TEST_ID.TEXT_FIELD)).toBeInTheDocument();

    // AND the register button should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON)).toBeInTheDocument();

    // AND the register button should be disabled
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON)).toBeDisabled();

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.FORM)).toMatchSnapshot();
  });

  describe("action tests", () => {
    test("should call notifyOnRegister on form submit", async () => {
      // WHEN the component is rendered
      render(<RegisterWithEmailForm notifyOnRegister={givenNotifyOnRegister} isRegistering={givenIsRegistering} />);

      // AND the register button should be disabled
      expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON)).toBeDisabled();

      // AND the register button should be rendered
      const registerButton = screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON);
      expect(registerButton).toBeInTheDocument();

      // Simulate form input and submission
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: "foo@bar.baz" } });

      act(() => {
        (PasswordInput as jest.Mock).mock.calls[0][0].onChange({ target: { value: "Password123$" } });
        (PasswordInput as jest.Mock).mock.calls[0][0].onValidityChange(true);
      });

      // AND the form is submitted
      fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

      // THEN expect notifyOnRegister to have been called
      expect(givenNotifyOnRegister).toHaveBeenCalledWith("foo@bar.baz", "Password123$");

      // AND expect no errors or warnings to be logged
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test.each([
      [
        "invalid email",
        {
          email: "invalid-email",
          password: "Password123$",
        },
      ],
    ])("should not submit form with %s", async (testCase, givenValue) => {
      // WHEN the component is rendered
      render(<RegisterWithEmailForm notifyOnRegister={givenNotifyOnRegister} isRegistering={givenIsRegistering} />);

      // AND the register button should be disabled
      expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON)).toBeDisabled();

      // Validate the form before submission
      const form = screen.getByTestId(DATA_TEST_ID.FORM);
      const isValid = (form as HTMLFormElement).reportValidity(); // Trigger built-in HTML5 form validation

      // AND the register button should be rendered
      const registerButton = screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON);
      expect(registerButton).toBeInTheDocument();

      // Simulate form input and submission
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: givenValue.email } });
      act(() => {
        (PasswordInput as jest.Mock).mock.calls[0][0].onChange({ target: { value: "Password123$" } });
        (PasswordInput as jest.Mock).mock.calls[0][0].onValidityChange(true);
      });

      // AND the form is submitted
      fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

      // THEN expect the form to be invalid
      expect(isValid).toBeFalsy();

      // AND expect no errors or warnings to be logged
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should not call notifyOnRegister if the password is invalid", async () => {
      // WHEN the component is rendered
      render(<RegisterWithEmailForm notifyOnRegister={givenNotifyOnRegister} isRegistering={givenIsRegistering} />);

      // AND the register button should be rendered
      const registerButton = screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON);
      expect(registerButton).toBeInTheDocument();
      // AND the register button should be disabled
      expect(registerButton).toBeDisabled();

      // Simulate form input and submission
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: "foo@bar.baz" } });
      act(() => {
        (PasswordInput as jest.Mock).mock.calls[0][0].onChange({ target: { value: "Password123$" } });
        (PasswordInput as jest.Mock).mock.calls[0][0].onValidityChange(false); // password is invalid
      });

      // THEN expect notifyOnRegister to not have been called
      expect(givenNotifyOnRegister).not.toHaveBeenCalled();
      // AND the register button should be disabled
      expect(registerButton).toBeDisabled();

      // AND expect no errors or warnings to be logged
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should disable everything if registering is still in progress", () => {
      // GIVEN the component is rendering
      const givenIsRegistering = true;
      render(<RegisterWithEmailForm notifyOnRegister={givenNotifyOnRegister} isRegistering={givenIsRegistering} />);

      // THEN expect all inputs and buttons to be disabled
      expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeDisabled();
      expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON)).toBeDisabled();
      expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON_CIRCULAR_PROGRESS)).toBeInTheDocument();

      expect(PasswordInput).toHaveBeenCalledWith(
        expect.objectContaining({
          disabled: true,
        }),
        expect.anything()
      );

      // AND expect no errors or warnings to be logged
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});
