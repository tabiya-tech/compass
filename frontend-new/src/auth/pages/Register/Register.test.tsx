import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, waitFor, act, fireEvent } from "src/_test_utilities/test-utils";
import { HashRouter } from "react-router-dom";
import Register, { DATA_TEST_ID } from "./Register";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { mockUseTokens } from "src/_test_utilities/mockUseTokens";
import RegisterWithEmailForm from "src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm";
import { DATA_TEST_ID as AUTH_HEADER_DATA_TEST_ID } from "src/auth/components/AuthHeader/AuthHeader";
import { AuthContext, AuthContextValue, TabiyaUser } from "src/auth/AuthProvider";
import { emailAuthService } from "src/auth/services/emailAuth/EmailAuth.service";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import { ServiceError } from "src/error/ServiceError/ServiceError";

//mock the SocialAuth component
jest.mock("src/auth/components/SocialAuth/SocialAuth", () => {
  const actual = jest.requireActual("src/auth/components/SocialAuth/SocialAuth");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.FIREBASE_AUTH_CONTAINER}></span>;
    }),
  };
});

// mock the emailAuthService
jest.mock("src/auth/services/emailAuth/EmailAuth.service", () => {
  return {
    emailAuthService: {
      handleRegisterWithEmail: jest.fn(),
      handleLogout: jest.fn(),
    },
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

// mock the RegisterWithEmailForm component
jest.mock("src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm", () => {
  const actual = jest.requireActual("src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm");
  return {
    ...actual,
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return <span data-testid={actual.DATA_TEST_ID.FORM}></span>;
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

describe("Testing Register component", () => {
  const authContextValue: AuthContextValue = {
    user: null,
    updateUserByToken: jest.fn(),
    clearUser: jest.fn(),
    isAuthenticationInProgress: false,
    isAuthenticated: false,
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
    const givenInvitationCode = "foo-bar";
    const givenName = "Foo Bar";
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenNotifyOnRegister = jest.fn();
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoading = false;

    // AND check invitation code status returns a valid code
    const checkInvitationCodeStatusMock = jest
      .spyOn(invitationsService, "checkInvitationCodeStatus")
      .mockImplementation(
        //@ts-ignore
        (initation_code, successCallback, failureCallback) => {
          successCallback({
            invitation_type: InvitationType.REGISTER,
            status: InvitationStatus.VALID,
            invitation_code: initation_code,
          });
        }
      );
    // WHEN the component is rendered within the AuthContext and Router
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Register
            postRegisterHandler={givenNotifyOnRegister}
            postLoginHandler={givenNotifyOnLogin}
            isPostLoginLoading={givenIsLoading}
          />
        </AuthContext.Provider>
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_CONTAINER)).toBeInTheDocument();

    // AND the header component should be rendered
    expect(screen.getByTestId(AUTH_HEADER_DATA_TEST_ID.AUTH_HEADER_CONTAINER)).toBeInTheDocument();

    // AND the form inputs and button should be displayed
    expect(RegisterWithEmailForm).toHaveBeenCalled();

    fireEvent.change(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT), {
      target: { value: givenInvitationCode },
    });

    await act(async () => {
      // Simulate form submission
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;

      await calls[calls.length - 1][0].notifyOnRegister(givenName, givenEmail, givenPassword);
    });

    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT)).toHaveValue(givenInvitationCode);
    });

    // Expect the register function to have been called
    await waitFor(() => {
      expect(emailAuthService.handleRegisterWithEmail).toHaveBeenCalledWith(
        givenEmail,
        givenPassword,
        givenName,
        expect.any(Function),
        expect.any(Function)
      );
    });

    // AND check that the invitation code status was checked
    expect(checkInvitationCodeStatusMock).toHaveBeenCalledWith(
      givenInvitationCode,
      expect.any(Function),
      expect.any(Function)
    );

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_CONTAINER)).toMatchSnapshot();
  });

  test("it should show success message on successful registration", async () => {
    // GIVEN a successful registration
    const givenName = "Foo Bar";
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenNotifyOnRegister = jest.fn();
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoading = false;

    (emailAuthService.handleRegisterWithEmail as jest.Mock).mockImplementation(
      (
        email: string,
        password: string,
        name: string,
        onSuccess: (user: TabiyaUser) => void,
        onError: (error: Error) => void
      ) => {
        onSuccess({ id: "mock-id", email: givenEmail, name: givenName } as TabiyaUser);
      }
    );

    // WHEN the component is rendered
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Register
            postRegisterHandler={givenNotifyOnRegister}
            postLoginHandler={givenNotifyOnLogin}
            isPostLoginLoading={givenIsLoading}
          />
        </AuthContext.Provider>
      </HashRouter>
    );

    // AND the register form is submitted
    await act(() => {
      (RegisterWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnRegister(givenName, givenEmail, givenPassword);
    });

    await act(async () => {
      // Simulate form submission
      const calls = (RegisterWithEmailForm as jest.Mock).mock.calls;

      await calls[calls.length - 1][0].notifyOnRegister(givenName, givenEmail, givenPassword);
    });

    // THEN expect the register function to have been called
    await waitFor(() => {
      expect(emailAuthService.handleRegisterWithEmail).toHaveBeenCalledWith(
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
  });

  test("it should show error message on failed registration", async () => {
    // GIVEN a failed registration
    (emailAuthService.handleRegisterWithEmail as jest.Mock).mockImplementation(
      (
        email: string,
        password: string,
        name: string,
        onSuccess: (user: TabiyaUser) => void,
        onError: (error: Error) => void
      ) => {
        onError(new Error("An unexpected error occurred. Please try again later."));
      }
    );

    const givenName = "Foo Bar";
    const givenEmail = "foo@bar.baz";
    const givenPassword = "password";
    const givenNotifyOnRegister = jest.fn();
    const givenNotifyOnLogin = jest.fn();
    const givenIsLoading = false;

    // AND check invitation code status returns a valid code
    jest.spyOn(invitationsService, "checkInvitationCodeStatus").mockImplementation(
      //@ts-ignore
      (initation_code, successCallback, failureCallback) => {
        successCallback({
          invitation_type: InvitationType.REGISTER,
          status: InvitationStatus.VALID,
          invitation_code: initation_code,
        });
      }
    );

    // WHEN the register form is submitted
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Register
            postRegisterHandler={givenNotifyOnRegister}
            postLoginHandler={givenNotifyOnLogin}
            isPostLoginLoading={givenIsLoading}
          />
        </AuthContext.Provider>
      </HashRouter>
    );

    // AND the register form is submitted
    await act(() => {
      (RegisterWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnRegister(givenName, givenEmail, givenPassword);
    });
    // THEN expect the register function to have been called
    await waitFor(() => {
      expect(emailAuthService.handleRegisterWithEmail).toHaveBeenCalledWith(
        givenEmail,
        givenPassword,
        givenName,
        expect.any(Function),
        expect.any(Function)
      );
    });

    // AND the error message should be displayed
    expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("An internal error has occurred.", { variant: "error" });
  });

  test("it should not call register when invitation code is invalid", async () => {
    // GIVEN an invalid invitation code
    const givenInvitationCode = "foo-bar";
    const givenName = "Foo Bar";
    const givenEmail = "foo-bar@foo.bar";

    // AND check invitation code check returns an invalid code
    jest.spyOn(invitationsService, "checkInvitationCodeStatus").mockImplementation(
      //@ts-ignore
      (initation_code, successCallback, failureCallback) => {
        failureCallback({
          message: "Invalid invitation code",
        } as ServiceError);
      }
    );

    // WHEN the component is rendered
    render(
      <HashRouter>
        <AuthContext.Provider value={authContextValue}>
          <Register postRegisterHandler={jest.fn()} postLoginHandler={jest.fn()} isPostLoginLoading={false} />
        </AuthContext.Provider>
      </HashRouter>
    );

    fireEvent.change(screen.getByTestId(DATA_TEST_ID.REGISTRATION_CODE_INPUT), {
      target: { value: givenInvitationCode },
    });

    // AND the register form is submitted
    (RegisterWithEmailForm as jest.Mock).mock.calls[0][0].notifyOnRegister(givenName, givenEmail, "password");

    // THEN expect the register function to not have been called
    await waitFor(() => {
      expect(emailAuthService.handleRegisterWithEmail).not.toHaveBeenCalled();
    });
  });
});
