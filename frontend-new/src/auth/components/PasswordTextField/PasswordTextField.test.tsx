// mute the console
import "src/_test_utilities/consoleMock";

import PasswordTextField from "./PasswordTextField";
import { render, screen } from "src/_test_utilities/test-utils";
import { fireEvent } from "@testing-library/react";

describe("PasswordTextField", () => {
  test("should render PasswordTextField successfully", () => {
    // GIVEN the PasswordTextField component
    const givenPasswordTextField = (
      <PasswordTextField
        value="password"
        onChange={jest.fn()}
        error={false}
        helperText=""
        disabled={false}
        inputProps={{ "data-testid": "password-input" }}
      />
    );

    // WHEN the component is rendered
    render(givenPasswordTextField);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the password text field to be in the document
    const passwordTextField = screen.getByTestId("password-input");
    expect(passwordTextField).toBeInTheDocument();
    // AND the password text field to have the correct value
    expect(passwordTextField).toHaveValue("password");
    expect(screen.getByRole("button")).toBeInTheDocument();
    // AND to match the snapshot
    expect(passwordTextField).toMatchSnapshot();
  });

  test("should show password when the button is clicked", () => {
    // GIVEN the PasswordTextField component is rendered
    const givenPasswordTextField = (
      <PasswordTextField
        value="password"
        onChange={jest.fn()}
        error={false}
        helperText=""
        disabled={false}
        inputProps={{ "data-testid": "password-input" }}
      />
    );
    render(givenPasswordTextField);

    // WHEN the user clicks the button
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // THEN the password should be visible
    const passwordTextField = screen.getByTestId("password-input");
    expect(passwordTextField).toHaveAttribute("type", "text");
  });

  test("should hide password when the button is clicked", () => {
    // GIVEN the PasswordTextField component is rendered
    const givenPasswordTextField = (
      <PasswordTextField
        value="password"
        onChange={jest.fn()}
        error={false}
        helperText=""
        disabled={false}
        inputProps={{ "data-testid": "password-input" }}
      />
    );
    render(givenPasswordTextField);
    // AND the user has clicked the button
    const button = screen.getByRole("button");
    fireEvent.click(button);
    // AND the password is visible
    const passwordTextField = screen.getByTestId("password-input");
    expect(passwordTextField).toHaveAttribute("type", "text");

    // WHEN the user clicks the button again
    fireEvent.click(button);

    // THEN the password should be hidden
    expect(passwordTextField).toHaveAttribute("type", "password");
  });
});
