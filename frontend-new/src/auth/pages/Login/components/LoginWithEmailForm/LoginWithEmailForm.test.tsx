// silence chatty errors
import "src/_test_utilities/consoleMock";
import LoginWithEmailForm, { DATA_TEST_ID } from "./LoginWithEmailForm";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import React from "react";

describe("Testing LoginWithEmailForm component", () => {
  const defaultProps = {
    email: "email",
    password: "password",
    notifyOnEmailChanged: jest.fn(),
    notifyOnPasswordChanged: jest.fn(),
    notifyOnPasswordValidityChanged: jest.fn(),
    isDisabled: false,
  };

  beforeEach(() => {
    // Clear console mocks and mock functions
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  test("it should show login form", async () => {
    // WHEN the component is rendered
    render(<LoginWithEmailForm {...defaultProps} />);

    // THEN the email input should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_LOGIN_FORM_EMAIL_INPUT)).toBeInTheDocument();

    // AND the password input should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_LOGIN_FORM_PASSWORD_INPUT)).toBeInTheDocument();

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_LOGIN_FORM_CONTAINER)).toMatchSnapshot();

    // AND expect no errors or warnings to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe("action tests", () => {
    test("should call notifyOnEmailChanged when the email field changes", async () => {
      // GIVEN an email
      const givenEmail = "foo@bar.baz";

      // WHEN the component is rendered
      render(<LoginWithEmailForm {...defaultProps} />);

      // AND email input is changed
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_LOGIN_FORM_EMAIL_INPUT), {
        target: { value: givenEmail },
      });

      // THEN expect the notifyOnEmailChanged function to have been called
      expect(defaultProps.notifyOnEmailChanged).toHaveBeenCalledWith("foo@bar.baz");

      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should call notifyOnPasswordChanged when the password field changes", async () => {
      // GIVEN a password
      const givenPassword = "Password123$";

      // WHEN the component is rendered
      render(<LoginWithEmailForm {...defaultProps} />);

      // Simulate form input and submission
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_LOGIN_FORM_PASSWORD_INPUT), {
        target: { value: givenPassword },
      });

      // THEN expect the notifyOnPasswordChanged function to have been called
      expect(defaultProps.notifyOnPasswordChanged).toHaveBeenCalledWith(givenPassword);

      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should disable inputs when isDisabled is true", () => {
      // WHEN the component is rendered with isDisabled=true
      render(<LoginWithEmailForm {...defaultProps} isDisabled={true} />);

      // THEN expect all inputs to be disabled
      expect(screen.getByTestId(DATA_TEST_ID.EMAIL_LOGIN_FORM_EMAIL_INPUT)).toBeDisabled();
      expect(screen.getByTestId(DATA_TEST_ID.EMAIL_LOGIN_FORM_PASSWORD_INPUT)).toBeDisabled();

      // AND expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
