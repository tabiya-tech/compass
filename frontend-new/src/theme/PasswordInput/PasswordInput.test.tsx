import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom"; // for additional matchers
import PasswordInput, { DATA_TEST_ID } from "./PasswordInput"; // Adjust the import path as needed

// Render Test
describe("PasswordInput component", () => {
  it("should render the password input field", () => {
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
  });

  // Action Test - Check password visibility toggle
  it("should toggle password visibility when the icon is clicked", () => {
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
  });
});
