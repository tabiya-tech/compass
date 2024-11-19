import "src/_test_utilities/consoleMock";
import React from "react";
import { fireEvent, render, screen, waitFor } from "src/_test_utilities/test-utils";
import DataProtectionAgreement, { DATA_TEST_ID } from "./DataProtectionAgreement";
import { HashRouter, useNavigate } from "react-router-dom";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { TabiyaUser } from "src/auth/auth.types";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import authStateService from "src/auth/services/AuthenticationState.service";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import AuthenticationService from "src/auth/services/Authentication.service";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { routerPaths } from "src/app/routerPaths";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { ServiceError } from "src/error/ServiceError/ServiceError";
import * as ServiceErrorLoggerModule from "src/error/ServiceError/logger";

// Mock the envService module
jest.mock("src/envService", () => ({
  getFirebaseAPIKey: jest.fn(() => "mock-api-key"),
  getFirebaseDomain: jest.fn(() => "mock-auth-domain"),
  getBackendUrl: jest.fn(() => "mock-backend-url"),
}));

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

describe("Testing Data Protection Policy component", () => {
  beforeEach(() => {
    // Clear console mocks and mock functions
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    const mockDate = new Date(2023, 5, 14); // June 14, 2023
    jest.spyOn(global, "Date").mockImplementation(() => mockDate);
  });

  describe("render tests", () => {
    test("it should show data protection policy", async () => {
      // WHEN the component is rendered
      render(
        <HashRouter>
          <DataProtectionAgreement />
        </HashRouter>
      );

      // THEN expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      // AND the component should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.DPA_CONTAINER)).toBeDefined();

      // AND the agreement body should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.AGREEMENT_BODY)).toBeInTheDocument();

      // AND the accept button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON)).toBeInTheDocument();

      // AND the accept checkbox should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_CHECKBOX)).toBeInTheDocument();

      // AND the reject button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.REJECT_DPA_BUTTON)).toBeInTheDocument();

      // AND the terms and conditions should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.TERMS_AND_CONDITIONS)).toBeInTheDocument();

      // AND the component should match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.DPA_CONTAINER)).toMatchSnapshot();
    });
  });

  describe("action tests", () => {
    describe("accept DPA", () => {
      test("should successfully accept the data protection policy", async () => {
        mockBrowserIsOnLine(true);

        // GIVEN the user preferences state service is mocked to set the user preferences
        jest.spyOn(userPreferencesStateService, "setUserPreferences").mockImplementation(() => {});

        const updateUserPreferences = jest.spyOn(userPreferencesService, "updateUserPreferences").mockResolvedValue({
          user_id: "",
          language: Language.en,
          accepted_tc: new Date(),
          sessions: [],
        });

        // AND the authStateService is mocked to return the given user
        const givenUser: TabiyaUser = {
          id: "0001",
          email: "foo@bar.baz",
          name: "Foo Bar",
        };

        jest.spyOn(authStateService.getInstance(), "getUser").mockImplementation(() => givenUser);

        // WHEN the component is rendered
        render(
          <HashRouter>
            <DataProtectionAgreement />
          </HashRouter>
        );

        // WHEN the user accepts the terms and conditions
        const checkBoxWrapper = screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_CHECKBOX);
        expect(checkBoxWrapper).toBeInTheDocument();
        const checkBoxInput = screen.getByRole("checkbox") as HTMLInputElement;
        fireEvent.click(checkBoxInput);

        // AND the user clicks the accept button
        expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON)).toBeEnabled();
        fireEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON));

        // THEN update user preferences should be called
        await waitFor(() => {
          expect(updateUserPreferences).toHaveBeenCalled();
        });

        // AND no errors should be logged
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();

        // AND user should be redirected to root
        await waitFor(() => {
          expect(useNavigate()).toHaveBeenCalledWith(routerPaths.ROOT, { replace: true });
        });
      });

      test("should fail to accept the data protection policy gracefully", async () => {
        // GIVEN a user is logged in
        const givenUser: TabiyaUser = {
          id: "0001",
          email: "foo@bar.baz",
          name: "Foo Bar",
        };

        // AND the user preferences service is mocked to throw an error
        jest
          .spyOn(userPreferencesService, "updateUserPreferences")
          .mockRejectedValue(new Error("Failed to update user preferences"));

        // AND the authStateService is mocked to return the given user
        jest.spyOn(authStateService.getInstance(), "getUser").mockImplementation(() => givenUser);

        // WHEN the component is rendered
        render(
          <HashRouter>
            <DataProtectionAgreement />
          </HashRouter>
        );

        // THEN expect no errors or warning to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();

        // AND the user accepts the terms and conditions
        const checkBoxWrapper = screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_CHECKBOX);
        expect(checkBoxWrapper).toBeInTheDocument();

        // WHEN the user clicks the checkbox
        const checkBoxInput = screen.getByRole("checkbox") as HTMLInputElement;
        fireEvent.click(checkBoxInput);

        // THEN expect the checkbox to be checked
        expect(checkBoxInput.checked).toBe(true);

        // AND the accept button should be enabled
        const acceptButton = screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON);
        expect(acceptButton).toBeEnabled();

        // WHEN the user clicks the accept button
        fireEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON));

        await waitFor(() => {
          expect(useNavigate()).not.toHaveBeenCalled();
        });

        // AND the error message should be displayed
        await waitFor(() => {
          expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
            "Failed to update user preferences: Failed to update user preferences",
            {
              variant: "error",
            }
          );
        });

        // AND the error should be logged
        expect(console.error).toHaveBeenCalled();
      });

      it("should log an error if the user is not found", async () => {
        const writeServiceErrorToLog = jest.spyOn(ServiceErrorLoggerModule, "writeServiceErrorToLog");

        // GIVEN getUser throws an error
        const givenError = new ServiceError("mockedService", "mockedFunction", "GET", "/", 400, "foo", "");
        jest.spyOn(authStateService.getInstance(), "getUser").mockImplementation(() => {
          throw givenError;
        });
        // WHEN the component is rendered
        render(
          <HashRouter>
            <DataProtectionAgreement />
          </HashRouter>
        );

        // AND the user clicks the checkbox
        const checkBoxInput = screen.getByRole("checkbox") as HTMLInputElement;
        fireEvent.click(checkBoxInput);

        // AND the user clicks the accept button
        fireEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON));

        // THEN expect the error to be logged
        expect(console.error).toHaveBeenCalled();

        // AND writeServiceErrorToLog should be called
        expect(writeServiceErrorToLog).toHaveBeenCalledWith(givenError, console.error);
      });

      test("should redirect user to the login if user is not found", async () => {
        // GIVEN the user preferences state service is mocked to set the user preferences
        jest.spyOn(userPreferencesStateService, "setUserPreferences").mockImplementation(() => {});

        // AND the authStateService is mocked to return null
        jest.spyOn(authStateService.getInstance(), "getUser").mockImplementation(() => null);

        // WHEN the component is rendered
        render(
          <HashRouter>
            <DataProtectionAgreement />
          </HashRouter>
        );

        // AND the user clicks the checkbox
        const checkBoxInput = screen.getByRole("checkbox") as HTMLInputElement;
        fireEvent.click(checkBoxInput);

        // AND the user clicks the accept button
        fireEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON));

        // AND the user should be navigated to the login page
        await waitFor(() => {
          expect(useNavigate()).toHaveBeenCalledWith(routerPaths.LOGIN);
        });
      });
    });

    describe("reject DPA", () => {
      test("should successfully log the user out when the user rejects the data protection policy", async () => {
        const getCurrentAuthenticationService = jest.spyOn(
          AuthenticationServiceFactory,
          "getCurrentAuthenticationService"
        );
        let authenticationService = {
          logout: jest.fn(),
        };

        getCurrentAuthenticationService.mockReturnValue(authenticationService as unknown as AuthenticationService);

        // GIVEN DPA Component is rendered
        render(
          <HashRouter>
            <DataProtectionAgreement />
          </HashRouter>
        );

        // AND there is a Reject DPA Button.
        const rejectButton = screen.getByTestId(DATA_TEST_ID.REJECT_DPA_BUTTON);
        expect(rejectButton).toBeInTheDocument();

        // WHEN the user clicks the reject button
        fireEvent.click(rejectButton);

        // THEN expect the user to be logged out
        expect(getCurrentAuthenticationService).toHaveBeenCalled();
        expect(authenticationService.logout).toHaveBeenCalled();

        // THEN the accept buttons should be disabled while the user is being logged out
        expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON)).toBeDisabled();

        // AND the user should be navigated to the login page
        await waitFor(() => {
          expect(useNavigate()).toHaveBeenCalledWith(routerPaths.LOGIN, { replace: true });
        });

        // AND snack bar should display a success message
        await waitFor(() => {
          expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Successfully logged out.", {
            variant: "success",
          });
        });

        // AND console should not log any errors
        expect(console.error).not.toHaveBeenCalled();
        expect(console.log).not.toHaveBeenCalled();
      });

      test("should log the error if the user fails to log out", () => {
        // GIVEN getting current authentication service throws an error
        const getCurrentAuthenticationService = jest.spyOn(
          AuthenticationServiceFactory,
          "getCurrentAuthenticationService"
        );
        const error = new Error("Failed to get current authentication service");
        getCurrentAuthenticationService.mockImplementation(() => {
          throw error;
        });

        // WHEN the component is rendered
        render(
          <HashRouter>
            <DataProtectionAgreement />
          </HashRouter>
        );

        // AND the reject button is clicked
        fireEvent.click(screen.getByTestId(DATA_TEST_ID.REJECT_DPA_BUTTON));

        // THEN expect the error to be logged
        expect(console.error).toHaveBeenCalledWith("Failed to log out", error);

        // AND snack bar should display an error message
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to log out.", { variant: "error" });
      });
    });
  });
});
