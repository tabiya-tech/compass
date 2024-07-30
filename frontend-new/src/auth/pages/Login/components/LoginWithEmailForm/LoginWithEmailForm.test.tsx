// silence chatty errors
import "src/_test_utilities/consoleMock";
import LoginWithEmailForm, { DATA_TEST_ID } from "./LoginWithEmailForm";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import { HashRouter } from "react-router-dom";
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
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoggingIn = false;
    render(
      <HashRouter>
        <LoginWithEmailForm notifyOnLogin={givenNotifyOnLogin} isLoggingIn={givenIsLoggingIn} />
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

    // AND the login button should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON)).toBeInTheDocument();

    // AND the login button should not be disabled
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON)).not.toBeDisabled();

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.FORM)).toMatchSnapshot();
  });

  describe("action tests", () => {
    test("should call notifyOnLogin on form submit", async () => {
      // WHEN the component is rendered
      const givenNotifyOnLogin = jest.fn();
      const givenIsLoggingIn = false;
      render(
        <HashRouter>
          <LoginWithEmailForm notifyOnLogin={givenNotifyOnLogin} isLoggingIn={givenIsLoggingIn} />
        </HashRouter>
      );

      // Simulate form input and submission
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: "john.doe@example.com" } });
      fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: "password" } });

      // AND the form is submitted
      fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

      // THEN expect notifyOnLogin to have been called
      expect(givenNotifyOnLogin).toHaveBeenCalled();
    });

    test("should disable everything when logging in", () => {
      // GIVEN the isLoggingIn flag is set to true
      const givenNotifyOnLogin = jest.fn();
      const givenIsLoggingIn = true;

      // WHEN the Login component is rendered within the AuthContext and Router
      render(
        <HashRouter>
          <LoginWithEmailForm notifyOnLogin={givenNotifyOnLogin} isLoggingIn={givenIsLoggingIn} />
        </HashRouter>
      );

      // THEN expect the login button to be disabled
      expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON)).toBeDisabled();
      // AND the email input to be disabled
      expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeDisabled();
      // AND the password input to be disabled
      expect(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT)).toBeDisabled();

      // AND login button circular progress to be displayed
      expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON_CIRCULAR_PROGRESS)).toBeInTheDocument();
    });
  });
});
