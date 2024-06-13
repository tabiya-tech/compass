import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor, fireEvent } from "src/_test_utilities/test-utils";
import { HashRouter } from "react-router-dom";
import Login, { DATA_TEST_ID } from "./Login";
import { AuthContext } from "src/auth/AuthProvider";

//mock the IDPAuth component
jest.mock("src/auth/components/IDPAuth/IDPAuth", () => {
  const actual = jest.requireActual("src/auth/components/IDPAuth/IDPAuth");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <div data-testid={actual.DATA_TEST_ID.FIREBASE_AUTH_CONTAINER}></div>;
    }),
  };
});

describe("Testing Login component with AuthProvider", () => {
  const loginMock = jest.fn();

  const authContextValue = {
    login: loginMock,
    user: null,
    register: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(() => {
    // Clear console mocks and mock functions
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    loginMock.mockClear();
  });

  test("it should show login form successfully", async () => {
    // Render the component within the AuthContext and Router
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Login />
        </AuthContext.Provider>
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toBeDefined();

    // AND the form inputs and button should be displayed
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_BUTTON)).toBeInTheDocument();

    // Simulate form input and submission
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: "john.doe@example.com" } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: "password" } });

    // Trigger form submission
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // Expect the login function to have been called
    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith(
        "john.doe@example.com",
        "password",
        expect.any(Function),
        expect.any(Function)
      );
    });

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.LOGIN_CONTAINER)).toMatchSnapshot();
  });
});
