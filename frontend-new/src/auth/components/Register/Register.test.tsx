import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor, fireEvent } from "src/_test_utilities/test-utils";
import { HashRouter, useNavigate } from "react-router-dom";
import Register, { DATA_TEST_ID } from "./Register";
import { AuthContext, TabiyaUser } from "src/auth/AuthProvider";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { routerPaths } from "src/app/routerPaths";
import { mockUseTokens } from "src/_test_utilities/mockUseTokens";
import { validatePassword } from "src/auth/components/Register/utils/validatePassword";

jest.mock("src/auth/components/Register/utils/validatePassword", () => ({
  validatePassword: jest.fn().mockReturnValue(""),
}));

//mock the IDPAuth component
jest.mock("src/auth/components/IDPAuth/IDPAuth", () => {
  const actual = jest.requireActual("src/auth/components/IDPAuth/IDPAuth");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.FIREBASE_AUTH_CONTAINER}></span>;
    }),
  };
});

// mock the snack bar provider
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      enqueueSnackbar: jest.fn(),
      closeSnackbar: jest.fn(),
    }),
  };
});

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

describe("Testing Register component with AuthProvider", () => {
  const registerMock = jest.fn();

  const authContextValue = {
    register: registerMock,
    user: null,
    login: jest.fn(),
    logout: jest.fn(),
    handlePageLoad: jest.fn(),
  };

  beforeEach(() => {
    // Clear console mocks and mock functions
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  beforeAll(() => mockUseTokens());

  test("it should show register form successfully", async () => {
    // GIVEN a user to register
    const givenName = "Foo Bar";
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    // WHEN the component is rendered within the AuthContext and Router
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Register />
        </AuthContext.Provider>
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_CONTAINER)).toBeDefined();

    // AND the form inputs and button should be displayed
    expect(screen.getByTestId(DATA_TEST_ID.NAME_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_BUTTON)).toBeInTheDocument();

    // Simulate form input and submission
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.NAME_INPUT), { target: { value: givenName } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: givenEmail } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: givenPassword } });

    // Trigger form submission
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // Expect the register function to have been called
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(
        givenEmail,
        givenPassword,
        givenName,
        expect.any(Function),
        expect.any(Function)
      );
    });

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_CONTAINER)).toMatchSnapshot();
  });

  test("it should show success message on successful registration", async () => {
    // GIVEN a successful registration
    const givenName = "Foo Bar";
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    registerMock.mockImplementation((email, password, name, onSuccess, onError) => {
      onSuccess({ id: "mock-id", email: givenEmail, name: givenName } as TabiyaUser);
    });

    // WHEN the component is rendered
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Register />
        </AuthContext.Provider>
      </HashRouter>
    );

    // AND the register form is submitted
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.NAME_INPUT), { target: { value: givenName } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: givenEmail } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: givenPassword } });

    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // THEN expect the register function to have been called
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(
        givenEmail,
        givenPassword,
        givenName,
        expect.any(Function),
        expect.any(Function)
      );
    });

    // AND no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the user should be redirected to the data protection Agreement page
    expect(useNavigate()).toHaveBeenCalledWith(routerPaths.VERIFY_EMAIL, { replace: true });
    // AND the success message should be displayed
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Verification Email Sent!", { variant: "success" });
  });

  test("it should show error message on failed registration", async () => {
    // GIVEN a failed registration
    registerMock.mockImplementation((email, password, name, onSuccess, onError) => {
      onError();
    });
    const givenName = "Foo Bar";
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";

    // WHEN the register form is submitted
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Register />
        </AuthContext.Provider>
      </HashRouter>
    );

    fireEvent.change(screen.getByTestId(DATA_TEST_ID.NAME_INPUT), { target: { value: givenName } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: givenEmail } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: givenPassword } });

    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // THEN expect the register function to have been called
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(
        givenEmail,
        givenPassword,
        givenName,
        expect.any(Function),
        expect.any(Function)
      );
    });

    // AND the error message should be displayed
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Registration failed", { variant: "error" });
  });
  test("it should call validatePassword on form submission", async () => {
    // GIVEN a user to register
    const givenName = "Foo Bar";
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";

    // Mock the validation function to return no errors
    (validatePassword as jest.Mock).mockReturnValueOnce("");

    // WHEN the component is rendered within the AuthContext and Router
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Register />
        </AuthContext.Provider>
      </HashRouter>
    );

    // Simulate form input and submission
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.NAME_INPUT), { target: { value: givenName } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: givenEmail } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: givenPassword } });

    // Trigger form submission
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // THEN expect the validatePassword function to have been called with the correct password
    await waitFor(() => {
      expect(validatePassword).toHaveBeenCalledWith(givenPassword);
    });
  });

  test("it should show error message if password validation fails", async () => {
    // GIVEN a user to register with an invalid password
    const givenName = "Foo Bar";
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";

    // Mock the validation function to return an error message
    (validatePassword as jest.Mock).mockReturnValue("Password must be at least 8 characters long");

    // WHEN the component is rendered within the AuthContext and Router
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Register />
        </AuthContext.Provider>
      </HashRouter>
    );

    // Simulate form input and submission
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.NAME_INPUT), { target: { value: givenName } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.EMAIL_INPUT), { target: { value: givenEmail } });
    fireEvent.change(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT), { target: { value: givenPassword } });
    fireEvent.submit(screen.getByTestId(DATA_TEST_ID.FORM));

    // THEN expect an error message to be displayed on the password field
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.PASSWORD_INPUT)).toHaveValue(givenPassword);
    });
    expect(screen.getByText("Password must be at least 8 characters long")).toBeInTheDocument();
  });
});
