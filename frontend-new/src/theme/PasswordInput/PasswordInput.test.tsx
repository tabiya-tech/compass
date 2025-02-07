import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import PasswordInput, { DATA_TEST_ID } from "./PasswordInput";
import * as validatePasswordModule from "src/theme/PasswordInput/utils/validatePassword";
import { DATA_TEST_ID as PASSWORD_REQUIREMENTS_DATA_TEST_ID } from "src/theme/PasswordInput/PasswordRequirements/PasswordRequirements";

// mock the password requirements component
jest.mock("src/theme/PasswordInput/PasswordRequirements/PasswordRequirements", () => {
  const actual = jest.requireActual("src/theme/PasswordInput/PasswordRequirements/PasswordRequirements");
  return {
    __esModule: true,
    ...actual,
    default: () => {
      return <span data-testid={actual.DATA_TEST_ID.PASSWORD_REQUIREMENTS} />;
    },
  };
});

// Render Test
describe("PasswordInput component", () => {
  beforeEach(() => {
    // Reset mock before each test
    jest.clearAllMocks();
  });

  test("should render the password input field", () => {
    // GIVEN the password input props.
    const givenProps = {
      label: "Password",
      "data-testid": DATA_TEST_ID.TEXT_FIELD,
    };

    // WHEN the component is rendered
    render(<PasswordInput {...givenProps} />);

    // THEN input element should be in the document
    const inputElement = screen.getByTestId(DATA_TEST_ID.TEXT_FIELD);
    expect(inputElement).toBeInTheDocument();

    // AND showPassword Icon should be visible.
    expect(screen.getByTestId(DATA_TEST_ID.ICON_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.VISIBILITY_ON_ICON)).toBeInTheDocument();

    // AND input should be in the document.
    const input = screen.getByTestId(DATA_TEST_ID.TEXT_FIELD_INPUT);
    expect(input).toBeInTheDocument();

    // AND it should have type=password.
    expect(input).toHaveAttribute("type", "password");

    // AND no errors or warnings should be logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  // Action Test - Check password visibility toggle
  test("should toggle password visibility when the icon is clicked", () => {
    // GIVEN the password input props.
    const givenProps = {
      label: "Password",
      "data-testid": DATA_TEST_ID.TEXT_FIELD,
    };

    // WHEN the component is rendered
    render(<PasswordInput {...givenProps} />);

    // AND the icon button is clicked
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.ICON_BUTTON));

    // THEN input should be in the document.
    const input = screen.getByTestId(DATA_TEST_ID.TEXT_FIELD_INPUT);

    // AND it should have type=text.
    expect(input).toHaveAttribute("type", "text");

    // AND the visibility icon should be off.
    expect(screen.getByTestId(DATA_TEST_ID.VISIBILITY_OFF_ICON)).toBeInTheDocument();

    // AND the icon button is clicked again
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.ICON_BUTTON));

    // THEN input should be in the document.
    const input2 = screen.getByTestId(DATA_TEST_ID.TEXT_FIELD_INPUT);

    // AND it should have type=password.
    expect(input2).toHaveAttribute("type", "password");

    // AND the visibility icon should be on.
    expect(screen.getByTestId(DATA_TEST_ID.VISIBILITY_ON_ICON)).toBeInTheDocument();

    // AND no errors or warnings should be logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should show helper text and trigger callback based on validation results", () => {
    // GIVEN the password validation returns an invalid result
    const validatePasswordSpy = jest.spyOn(validatePasswordModule, "validatePassword");
    const mockOnValidityChange = jest.fn();
    const givenProps = {
      label: "Password",
      "data-testid": DATA_TEST_ID.TEXT_FIELD,
      onValidityChange: mockOnValidityChange,
      shouldValidatePassword: true,
    };
    validatePasswordSpy.mockReturnValueOnce({
      isLongEnough: false,
      hasLowercase: true,
      hasUppercase: false,
      hasNumber: true,
      hasSpecialChar: false,
    });

    // WHEN the component is rendered with an invalid password
    const { rerender } = render(<PasswordInput {...givenProps} value="weak" />);

    // THEN the validation function should be called
    expect(validatePasswordSpy).toHaveBeenCalledWith("weak");

    // AND the helper text should be visible with validation messages
    expect(screen.getByTestId(PASSWORD_REQUIREMENTS_DATA_TEST_ID.PASSWORD_REQUIREMENTS)).toBeInTheDocument();
    // AND the callback should be called with false
    expect(mockOnValidityChange).toHaveBeenLastCalledWith(false);

    // WHEN validation returns valid result
    validatePasswordSpy.mockReturnValue({
      isLongEnough: true,
      hasLowercase: true,
      hasUppercase: true,
      hasNumber: true,
      hasSpecialChar: true,
    });

    // AND component is rerendered with valid password
    rerender(<PasswordInput {...givenProps} value="StrongPass123!" />);

    // THEN the validation function should be called with new value
    expect(validatePasswordSpy).toHaveBeenCalledWith("StrongPass123!");

    // AND the helper text should no longer be visible
    expect(screen.queryByTestId(PASSWORD_REQUIREMENTS_DATA_TEST_ID.PASSWORD_REQUIREMENTS)).not.toBeInTheDocument();

    // AND the callback should be called with true
    expect(mockOnValidityChange).toHaveBeenLastCalledWith(true);

    // AND the input should not show error state
    expect(screen.getByTestId(DATA_TEST_ID.TEXT_FIELD)).not.toHaveClass("Mui-error");

    // AND no errors or warnings should be logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should not show helper text when password is empty", () => {
    // GIVEN the password input props
    const givenProps = {
      label: "Password",
      "data-testid": DATA_TEST_ID.TEXT_FIELD,
    };

    // WHEN the component is rendered with empty password
    render(<PasswordInput {...givenProps} value="" />);

    // THEN the helper text should not be visible
    expect(screen.queryByTestId(PASSWORD_REQUIREMENTS_DATA_TEST_ID.PASSWORD_REQUIREMENTS)).not.toBeInTheDocument();

    // AND no errors or warnings should be logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should handle onChange events", () => {
    // GIVEN the password input props with a mock onChange
    const mockOnChange = jest.fn();
    const givenProps = {
      label: "Password",
      "data-testid": DATA_TEST_ID.TEXT_FIELD,
      onChange: mockOnChange,
    };

    // WHEN the component is rendered
    render(<PasswordInput {...givenProps} />);

    // AND a change event is triggered
    const input = screen.getByTestId(DATA_TEST_ID.TEXT_FIELD_INPUT);
    fireEvent.change(input, { target: { value: "newPassword123!" } });

    // THEN onChange should be called with the event
    expect(mockOnChange).toHaveBeenCalled();
    expect(mockOnChange.mock.calls[0][0].target.value).toBe("newPassword123!");

    // AND no errors or warnings should be logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
  test("should not validate password when the shouldValidate password prop is set to false", () => {
    // GIVEN the password validation returns an invalid result
    const validatePasswordSpy = jest.spyOn(validatePasswordModule, "validatePassword");
    const mockOnValidityChange = jest.fn();
    const givenProps = {
      label: "Password",
      "data-testid": DATA_TEST_ID.TEXT_FIELD,
      onValidityChange: mockOnValidityChange,
      shouldValidatePassword: false,
    };
    validatePasswordSpy.mockReturnValueOnce({
      isLongEnough: false,
      hasLowercase: true,
      hasUppercase: false,
      hasNumber: true,
      hasSpecialChar: false,
    });

    // WHEN the component is rendered with an invalid password
    render(<PasswordInput {...givenProps} value="weak" />);

    // THEN the validation function should be called with an empty string
    expect(validatePasswordSpy).toHaveBeenCalledWith("");

    // AND the helper text should not be visible with validation messages
    expect(screen.queryByTestId(PASSWORD_REQUIREMENTS_DATA_TEST_ID.PASSWORD_REQUIREMENTS)).not.toBeInTheDocument();

    // AND no errors or warnings should be logged
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
