// silence chatty errors
import "src/_test_utilities/consoleMock";
import LoginWithEmailForm, { DATA_TEST_ID } from "./LoginWithEmailForm";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import React from "react";

describe("Testing LoginWithEmailForm component", () => {
  beforeEach(() => {
    // Clear console mocks and mock functions
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  test("it should show login form", async () => {
    // WHEN the component is rendered
    const givenNotifyOnEmailChange = jest.fn();
    const givenNotifyOnPasswordChange = jest.fn();
    const givenNotifyOnFocused = jest.fn();
    const givenEmailValue = "email";
    const givenPasswordValue = "password";
    const givenIsDisabled = false;

    render(
      <LoginWithEmailForm
        email={givenEmailValue}
        password={givenPasswordValue}
        notifyOnEmailChanged={givenNotifyOnEmailChange}
        notifyOnPasswordChanged={givenNotifyOnPasswordChange}
        notifyOnFocused={givenNotifyOnFocused}
        isDisabled={givenIsDisabled}
      />
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the email input should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_LOGIN_FORM_EMAIL_INPUT)).toBeInTheDocument();

    // AND the password input should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_LOGIN_FORM_PASSWORD_INPUT)).toBeInTheDocument();

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_LOGIN_FORM_CONTAINER)).toMatchSnapshot();
  });

  describe("action tests", () => {
    test("should call notigyOnEmailChanged when the email field changes", async () => {
      // WHEN the component is rendered
      const givenNotifyOnEmailChange = jest.fn();
      const givenNotifyOnPasswordChange = jest.fn();
      const givenNotifyOnFocused = jest.fn();
      const givenEmailValue = "email";
      const givenPasswordValue = "password";
      const givenIsDisabled = false;

      render(
        <LoginWithEmailForm
          email={givenEmailValue}
          password={givenPasswordValue}
          notifyOnEmailChanged={givenNotifyOnEmailChange}
          notifyOnPasswordChanged={givenNotifyOnPasswordChange}
          notifyOnFocused={givenNotifyOnFocused}
          isDisabled={givenIsDisabled}
        />
      );

      // Simulate form input and submission
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_LOGIN_FORM_EMAIL_INPUT), {
        target: { value: "foo@bar.baz" },
      });

      // THEN expect the notifyOnEmailChanged function to have been called
      expect(givenNotifyOnEmailChange).toHaveBeenCalledWith("foo@bar.baz");
    });

    test("should call notifyOnPasswordChanged when the password field changes", async () => {
      // WHEN the component is rendered
      const givenNotifyOnEmailChange = jest.fn();
      const givenNotifyOnPasswordChange = jest.fn();
      const givenNotifyOnFocused = jest.fn();
      const givenEmailValue = "email";
      const givenPasswordValue = "password";
      const givenIsDisabled = false;

      render(
        <LoginWithEmailForm
          email={givenEmailValue}
          password={givenPasswordValue}
          notifyOnEmailChanged={givenNotifyOnEmailChange}
          notifyOnPasswordChanged={givenNotifyOnPasswordChange}
          notifyOnFocused={givenNotifyOnFocused}
          isDisabled={givenIsDisabled}
        />
      );

      // Simulate form input and submission
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_LOGIN_FORM_PASSWORD_INPUT), {
        target: { value: "Pa$$word123" },
      });

      // THEN expect the notifyOnPasswordChanged function to have been called
      expect(givenNotifyOnPasswordChange).toHaveBeenCalledWith("Pa$$word123");
    });
  });
});
