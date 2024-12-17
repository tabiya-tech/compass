import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import VerifyEmail, { DATA_TEST_ID } from "./VerifyEmail";
import { HashRouter, useNavigate } from "react-router-dom";
import { DATA_TEST_ID as AUTH_HEADER_DATA_TEST_ID } from "src/auth/components/AuthHeader/AuthHeader";

// mock the router
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    __esModule: true,
    useNavigate: jest.fn().mockReturnValue(jest.fn()),
    NavLink: jest.fn().mockImplementation(() => {
      return <></>;
    }),
  };
});

// mock the AuthHeader component
jest.mock("src/auth/components/AuthHeader/AuthHeader", () => {
  const actual = jest.requireActual("src/auth/components/AuthHeader/AuthHeader");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.AUTH_HEADER_CONTAINER}></span>;
    }),
  };
});

// mock the bugReport component
jest.mock("src/feedback/bugReport/bugReportButton/BugReportButton", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <div data-testid="bug-report"></div>;
    }),
  };
});

describe("Testing Verify Email component", () => {
  beforeEach(() => {
    // Clear console mocks and mock functions
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  test("it should show verification page", async () => {
    // WHEN the component is rendered
    render(
      <HashRouter>
        <VerifyEmail />
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.VERIFY_EMAIL_CONTAINER)).toBeInTheDocument();

    // AND the header component should be rendered
    expect(screen.getByTestId(AUTH_HEADER_DATA_TEST_ID.AUTH_HEADER_CONTAINER)).toBeInTheDocument();

    // AND the back to login button should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.BACK_TO_LOGIN_BUTTON)).toBeInTheDocument();

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.VERIFY_EMAIL_CONTAINER)).toMatchSnapshot();
  });

  test("should successfully navigate back to login when the back to login button is pressed", async () => {
    // GIVEN the component is rendered
    render(
      <HashRouter>
        <VerifyEmail />
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the back to login button should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.BACK_TO_LOGIN_BUTTON)).toBeInTheDocument();

    // WHEN the user clicks the back to login button
    // AND WHEN the accept button is clicked
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.BACK_TO_LOGIN_BUTTON));

    // THEN expect the user to be redirected to the root path
    expect(useNavigate).toHaveBeenCalled();
  });
});
