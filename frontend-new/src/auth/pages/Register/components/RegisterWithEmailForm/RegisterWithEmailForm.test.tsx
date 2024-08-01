// silence chatty console
import "src/_test_utilities/consoleMock";
import RegisterWithEmailForm, { DATA_TEST_ID } from "./RegisterWithEmailForm";
import React from "react";
import { HashRouter } from "react-router-dom";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import { validatePassword } from "src/auth/utils/validatePassword";

// mock the password validator
jest.mock("src/auth/utils/validatePassword", () => {
  return {
    __esModule: true,
    validatePassword: jest.fn().mockReturnValue(""),
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
    render(
      <HashRouter>
        <RegisterWithEmailForm notifyOnRegister={givenNotifyOnRegister} isRegistering={givenIsRegistering} />
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.FORM)).toBeDefined();

    // AND the email input should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeInTheDocument();

    // AND the password input should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT)).toBeInTheDocument();

    // AND the register button should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON)).toBeInTheDocument();

    // AND the register button should not be disabled
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON)).not.toBeDisabled();

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.FORM)).toMatchSnapshot();
  });

  describe("action tests", () => {
    test("should call notifyOnRegister on form submit", async () => {
      // WHEN the component is rendered
      render(
        <HashRouter>
          <RegisterWithEmailForm notifyOnRegister={givenNotifyOnRegister} isRegistering={givenIsRegistering} />
        </HashRouter>
      );

      // AND the register button should not be disabled
      expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON)).not.toBeDisabled();

      // AND the register button should be rendered
      const registerButton = screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON);
      expect(registerButton).toBeInTheDocument();

      // Simulate form input and submission
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.NAME_INPUT), { target: { value: "Foo Bar" } });
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: "foo@bar.baz" } });
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: "Password123$" } });

      // AND the form is submitted
      fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

      // THEN expect notifyOnRegister to have been called
      expect(givenNotifyOnRegister).toHaveBeenCalledWith("Foo Bar", "foo@bar.baz", "Password123$");
    });

    test.each([
      [
        "invalid email",
        {
          name: "Foo Bar",
          email: "invalid-email",
          password: "Password123$",
        },
      ],
      [
        "invalid name",
        {
          name: "",
          email: "foo@bar.baz",
          password: "Password123$",
        },
      ],
    ])("should not validate the form when the form has an %s", async (_description, givenValue) => {
      // WHEN the component is rendered
      render(
        <HashRouter>
          <RegisterWithEmailForm notifyOnRegister={givenNotifyOnRegister} isRegistering={givenIsRegistering} />
        </HashRouter>
      );

      // AND the register button should not be disabled
      expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON)).not.toBeDisabled();

      // Validate the form before submission
      const form = screen.getByTestId(DATA_TEST_ID.FORM);
      const isValid = (form as HTMLFormElement).reportValidity(); // Trigger built-in HTML5 form validation

      // AND the register button should be rendered
      const registerButton = screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON);
      expect(registerButton).toBeInTheDocument();

      // Simulate form input and submission
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.NAME_INPUT), { target: { value: givenValue.name } });
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: givenValue.email } });
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: givenValue.password } });

      // AND the form is submitted
      fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

      // THEN expect the form to be invalid
      expect(isValid).toBeFalsy();
    });

    test("should not call notifyOnRegister if the password is invalid", async () => {
      // GIVEN the password validator will return false for the given password
      (validatePassword as jest.Mock).mockReturnValueOnce("Password must contain at least one uppercase letter");
      const givenPassword = "password";
      // WHEN the component is rendered
      render(
        <HashRouter>
          <RegisterWithEmailForm notifyOnRegister={givenNotifyOnRegister} isRegistering={givenIsRegistering} />
        </HashRouter>
      );

      // AND the register button should not be disabled
      expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON)).not.toBeDisabled();

      // AND the register button should be rendered
      const registerButton = screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON);
      expect(registerButton).toBeInTheDocument();

      // Simulate form input and submission
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.NAME_INPUT), { target: { value: "Foo Bar" } });
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: "foo@bar.baz" } });
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: givenPassword } });

      // AND the form is submitted
      fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

      // THEN expect notifyOnRegister to not have been called
      expect(givenNotifyOnRegister).not.toHaveBeenCalled();
    });

    test("should disable everything if registering is still in progress", () => {
      // GIVEN the component is rendering
      const givenIsRegistering = true;
      render(
        <HashRouter>
          <RegisterWithEmailForm notifyOnRegister={givenNotifyOnRegister} isRegistering={givenIsRegistering} />
        </HashRouter>
      );

      // THEN expect all inputs and buttons to be disabled
      expect(screen.getByTestId(DATA_TEST_ID.NAME_INPUT)).toBeDisabled();
      expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeDisabled();
      expect(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT)).toBeDisabled();
      expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON)).toBeDisabled();
      expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON_CIRCULAR_PROGRESS)).toBeInTheDocument();
    });
  });
});
