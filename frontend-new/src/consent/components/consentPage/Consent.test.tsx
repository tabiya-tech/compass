import "src/_test_utilities/consoleMock";
import React from "react";
import { userEvent, render, screen, waitFor } from "src/_test_utilities/test-utils";
import Consent, { DATA_TEST_ID } from "./Consent";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { TabiyaUser } from "src/auth/auth.types";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import authStateService from "src/auth/services/AuthenticationState.service";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import AuthenticationService from "src/auth/services/Authentication.service";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { routerPaths } from "src/app/routerPaths";
import {
  SensitivePersonalDataRequirement,
  Language,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import * as RestAPIErrorLoggerModule from "src/error/restAPIError/logger";
import { DATA_TEST_ID as BACKDROP_TEST_ID } from "src/theme/Backdrop/Backdrop";
import { AuthenticationError } from "src/error/commonErrors";
import { DATA_TEST_ID as CONFIRM_MODAL_DIALOG_TEST_ID } from "src/theme/confirmModalDialog/ConfirmModalDialog";

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

describe("Testing Consent Page", () => {
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
    test("it should show consent screen with both agreements", async () => {
      // WHEN the component is rendered
      render(<Consent />);

      // THEN expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      // AND the component should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.CONSENT_CONTAINER)).toBeDefined();

      // AND the agreement body should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.AGREEMENT_BODY)).toBeInTheDocument();

      // AND the accept button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_BUTTON)).toBeInTheDocument();

      // AND the accept checkbox should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_CHECKBOX_CONTAINER)).toBeInTheDocument();

      // AND the reject button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.REJECT_BUTTON)).toBeInTheDocument();

      // AND the terms and conditions should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_TERMS_AND_CONDITIONS_TEXT)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_TERMS_AND_CONDITIONS_CHECKBOX_CONTAINER)).toBeInTheDocument();

      // AND The data protection checkbox should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_CHECKBOX_CONTAINER)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_TERMS_AND_CONDITIONS_TEXT)).toBeInTheDocument();

      // AND the support container should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SUPPORT_CONTAINER)).toBeInTheDocument();

      // AND the Google logo should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.GOOGLE_LOGO)).toBeInTheDocument();

      // AND the component should match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.CONSENT_CONTAINER)).toMatchSnapshot();
    });
  });

  describe("action tests", () => {
    describe("accept agreements", () => {
      test("should successfully accept the agreements", async () => {
        mockBrowserIsOnLine(true);

        // GIVEN the user preferences state service is mocked to set the user preferences
        jest.spyOn(UserPreferencesStateService.getInstance(), "setUserPreferences").mockImplementation(() => {});

        const updateUserPreferences = jest.spyOn(userPreferencesService, "updateUserPreferences").mockResolvedValue({
          user_id: "",
          language: Language.en,
          accepted_tc: new Date(),
          sessions: [],
          sessions_with_feedback: [],
          has_sensitive_personal_data: false,
          sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        });

        // AND the authStateService is mocked to return the given user
        const givenUser: TabiyaUser = {
          id: "0001",
          email: "foo@bar.baz",
          name: "Foo Bar",
        };

        jest.spyOn(authStateService.getInstance(), "getUser").mockImplementation(() => givenUser);

        // WHEN the component is rendered
        render(<Consent />);

        // WHEN the user accepts Data protection Agreement
        const dpaCheckBoxWrapper = screen.getByTestId(DATA_TEST_ID.ACCEPT_CHECKBOX_CONTAINER);
        expect(dpaCheckBoxWrapper).toBeInTheDocument();
        const dpaCheckbox = dpaCheckBoxWrapper.getElementsByTagName("input")[0] as HTMLInputElement;
        await userEvent.click(dpaCheckbox);

        // AND Terms and Conditions are accepted
        const tcCheckBoxWrapper = screen.getByTestId(DATA_TEST_ID.ACCEPT_TERMS_AND_CONDITIONS_CHECKBOX_CONTAINER);
        expect(tcCheckBoxWrapper).toBeInTheDocument();
        const tcCheckbox = tcCheckBoxWrapper.getElementsByTagName("input")[0] as HTMLInputElement;
        await userEvent.click(tcCheckbox);

        // AND the user clicks the accept button
        expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_BUTTON)).toBeEnabled();
        await userEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_BUTTON));

        // THEN update user preferences should be called
        expect(updateUserPreferences).toHaveBeenCalled();

        // AND no errors should be logged
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();

        // AND user should be redirected to root
        expect(useNavigate()).toHaveBeenCalledWith(routerPaths.ROOT, { replace: true });
      });

      test("should fail to accept agreements gracefully", async () => {
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
        render(<Consent />);

        // THEN expect no errors or warning to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();

        // AND the user accepts the terms and conditions
        const checkBoxWrapper = screen.getByTestId(DATA_TEST_ID.ACCEPT_CHECKBOX_CONTAINER);
        expect(checkBoxWrapper).toBeInTheDocument();

        // WHEN the user accepts data protection agreement
        const dpaCheckbox = screen
          .getByTestId(DATA_TEST_ID.ACCEPT_CHECKBOX_CONTAINER)
          .getElementsByTagName("input")[0] as HTMLInputElement;
        await userEvent.click(dpaCheckbox);

        // AND Terms and Conditions are accepted
        const checkBoxInput = screen
          .getByTestId(DATA_TEST_ID.ACCEPT_TERMS_AND_CONDITIONS_CHECKBOX_CONTAINER)
          .getElementsByTagName("input")[0] as HTMLInputElement;

        await userEvent.click(checkBoxInput);

        // THEN expect the checkbox to be checked
        expect(checkBoxInput.checked).toBe(true);

        // AND the accept button should be enabled
        const acceptButton = screen.getByTestId(DATA_TEST_ID.ACCEPT_BUTTON);
        expect(acceptButton).toBeEnabled();

        // WHEN the user clicks the accept button
        await userEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_BUTTON));

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
        const writeRestAPIErrorToLog = jest.spyOn(RestAPIErrorLoggerModule, "writeRestAPIErrorToLog");

        // GIVEN getUser throws an error
        const givenError = new RestAPIError("mockedService", "mockedFunction", "GET", "/", 400, "foo", "");
        jest.spyOn(authStateService.getInstance(), "getUser").mockImplementation(() => {
          throw givenError;
        });
        // WHEN the component is rendered
        render(<Consent />);

        // AND the user accepts data protection agreement
        const dpaCheckbox = screen
          .getByTestId(DATA_TEST_ID.ACCEPT_CHECKBOX_CONTAINER)
          .getElementsByTagName("input")[0] as HTMLInputElement;

        await userEvent.click(dpaCheckbox);

        // AND Terms and Conditions are accepted
        const checkBoxInput = screen
          .getByTestId(DATA_TEST_ID.ACCEPT_TERMS_AND_CONDITIONS_CHECKBOX_CONTAINER)
          .getElementsByTagName("input")[0] as HTMLInputElement;
        await userEvent.click(checkBoxInput);

        // AND the user clicks the accept button
        await userEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_BUTTON));

        // THEN expect the error to be logged
        expect(console.error).toHaveBeenCalled();

        // AND the error should be logged
        expect(writeRestAPIErrorToLog).toHaveBeenCalledWith(givenError, console.error);
      });

      test("should redirect user to the login if user is not found", async () => {
        // GIVEN the user preferences state service is mocked to set the user preferences
        jest.spyOn(UserPreferencesStateService.getInstance(), "setUserPreferences").mockImplementation(() => {});

        // AND the authStateService is mocked to return null
        jest.spyOn(authStateService.getInstance(), "getUser").mockImplementation(() => null);

        // WHEN the component is rendered
        render(<Consent />);

        //  the user accepts data protection agreement
        const dpaCheckbox = screen
          .getByTestId(DATA_TEST_ID.ACCEPT_CHECKBOX_CONTAINER)
          .getElementsByTagName("input")[0] as HTMLInputElement;
        await userEvent.click(dpaCheckbox);

        // AND Terms and Conditions are accepted
        const checkBoxInput = screen
          .getByTestId(DATA_TEST_ID.ACCEPT_TERMS_AND_CONDITIONS_CHECKBOX_CONTAINER)
          .getElementsByTagName("input")[0] as HTMLInputElement;

        await userEvent.click(checkBoxInput);
        // AND the user clicks the accept button
        await userEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_BUTTON));

        // AND the user should be navigated to the login page
        await waitFor(() => {
          expect(useNavigate()).toHaveBeenCalledWith(routerPaths.LOGIN);
        });
      });
    });

    describe("reject consent", () => {
      test("should successfully log the user out when the user rejects the agreements", async () => {
        const getCurrentAuthenticationService = jest.spyOn(
          AuthenticationServiceFactory,
          "getCurrentAuthenticationService"
        );
        let authenticationService = {
          logout: jest.fn(),
        };

        getCurrentAuthenticationService.mockReturnValue(authenticationService as unknown as AuthenticationService);

        // GIVEN Consent Component is rendered
        render(<Consent />);

        // AND there is a Reject Consent Button.
        const rejectButton = screen.getByTestId(DATA_TEST_ID.REJECT_BUTTON);
        expect(rejectButton).toBeInTheDocument();

        // WHEN the user clicks the reject button
        await userEvent.click(rejectButton);
        // AND the approval model should be displayed
        expect(screen.getByTestId(CONFIRM_MODAL_DIALOG_TEST_ID.CONFIRM_MODAL)).toBeInTheDocument();
        // AND the user clicks the confirm button
        const confirmButton = screen.getByTestId(CONFIRM_MODAL_DIALOG_TEST_ID.CONFIRM_MODAL_CONFIRM);
        await userEvent.click(confirmButton);

        // THEN expect the approval model to be closed
        await waitFor(() => {
          expect(screen.queryByTestId(CONFIRM_MODAL_DIALOG_TEST_ID.CONFIRM_MODAL)).not.toBeInTheDocument();
        });
        // AND the logout backdrop should be displayed
        expect(screen.getByTestId(BACKDROP_TEST_ID.BACKDROP_CONTAINER)).toBeInTheDocument();
        expect(screen.getByTestId(BACKDROP_TEST_ID.MESSAGE_ELEMENT)).toHaveTextContent("Logging you out...");

        // THEN expect the user to be logged out
        await waitFor(() => {
          expect(getCurrentAuthenticationService).toHaveBeenCalled();
        });
        expect(authenticationService.logout).toHaveBeenCalled();

        // THEN the accept button should be disabled while the user is being logged out
        expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_BUTTON)).toBeDisabled();

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

      test("should log the error if the user fails to log out", async () => {
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
        render(<Consent />);
        // AND the reject button is clicked
        await userEvent.click(screen.getByTestId(DATA_TEST_ID.REJECT_BUTTON));
        // AND the approval model should be displayed
        expect(screen.getByTestId(CONFIRM_MODAL_DIALOG_TEST_ID.CONFIRM_MODAL)).toBeInTheDocument();
        // AND the user clicks the confirm button
        const confirmButton = screen.getByTestId(CONFIRM_MODAL_DIALOG_TEST_ID.CONFIRM_MODAL_CONFIRM);
        await userEvent.click(confirmButton);

        // THEN expect the error to be logged
        await waitFor(() => {
          expect(console.error).toHaveBeenCalledWith(new AuthenticationError("Failed to log out", error));
        });
        // AND snack bar should display an error message
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to log out.", { variant: "error" });
      });

      test("should not log the user out when the user clicks the cancel button on the approve modal", async () => {
        // GIVEN DPA Component is rendered
        render(<Consent />);

        // WHEN the user clicks the reject button
        const rejectButton = screen.getByTestId(DATA_TEST_ID.REJECT_BUTTON);
        await userEvent.click(rejectButton);
        // AND the approval model is open
        expect(screen.getByTestId(CONFIRM_MODAL_DIALOG_TEST_ID.CONFIRM_MODAL)).toBeInTheDocument();
        // AND the user clicks the cancel button
        const cancelButton = screen.getByTestId(CONFIRM_MODAL_DIALOG_TEST_ID.CONFIRM_MODAL_CANCEL);
        await userEvent.click(cancelButton);

        // THEN expect the modal to be closed
        await waitFor(() => {
          expect(screen.queryByTestId(CONFIRM_MODAL_DIALOG_TEST_ID.CONFIRM_MODAL)).not.toBeInTheDocument();
        });
        // AND the user should not be logged out
        expect(useNavigate()).not.toHaveBeenCalled();
      });
    });

    describe("Redirecting", () => {
      it("should redirect the user to the root page if the user does not require sensitive personal data", async () => {
        // GIVEN the user preferences state service is mocked to set the user preferences
        jest.spyOn(userPreferencesService, "updateUserPreferences").mockResolvedValue({
          user_id: "given user id",
          language: Language.en,
          accepted_tc: new Date(),
          has_sensitive_personal_data: false,
          sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
          sessions: [],
          sessions_with_feedback: [],
        });

        // AND the authStateService  returns an actual user
        jest.spyOn(authStateService.getInstance(), "getUser").mockReturnValue({
          id: "given user id",
          name: "given user name",
          email: "given email",
        });

        // WHEN the component is rendered
        render(<Consent />);

        // AND the user accepts data protection agreement
        const dpaCheckbox = screen
          .getByTestId(DATA_TEST_ID.ACCEPT_CHECKBOX_CONTAINER)
          .getElementsByTagName("input")[0] as HTMLInputElement;

        await userEvent.click(dpaCheckbox);

        // AND Terms and Conditions are accepted
        const checkBoxInput = screen
          .getByTestId(DATA_TEST_ID.ACCEPT_TERMS_AND_CONDITIONS_CHECKBOX_CONTAINER)
          .getElementsByTagName("input")[0] as HTMLInputElement;

        await userEvent.click(checkBoxInput);

        // AND the user clicks the accept button
        await userEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_BUTTON));

        // AND the user should be navigated to the login page
        await waitFor(() => {
          expect(useNavigate()).toHaveBeenCalledWith(routerPaths.ROOT, { replace: true });
        });
      });

      it("should redirect the user to the sensitive data page if the user requires sensitive personal data", async () => {
        // GIVEN the user preferences state service is mocked to set the user preferences.
        jest.spyOn(userPreferencesService, "updateUserPreferences").mockResolvedValue({
          user_id: "given user id",
          language: Language.en,
          accepted_tc: new Date(),
          has_sensitive_personal_data: false,
          sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
          sessions: [],
          sessions_with_feedback: [],
        });

        // AND the authStateService  returns an actual user
        jest.spyOn(authStateService.getInstance(), "getUser").mockReturnValue({
          id: "given user id",
          name: "given user name",
          email: "given email",
        });

        // AND the user requires sensitive personal data.
        jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
          user_id: "given user id",
          language: Language.en,
          accepted_tc: new Date(),
          has_sensitive_personal_data: false,
          sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
          sessions: [],
          sessions_with_feedback: [],
        });

        // WHEN the component is rendered
        render(<Consent />);

        // AND the user accepts data protection agreement
        const dpaCheckbox = screen
          .getByTestId(DATA_TEST_ID.ACCEPT_CHECKBOX_CONTAINER)
          .getElementsByTagName("input")[0] as HTMLInputElement;
        await userEvent.click(dpaCheckbox);

        // AND Terms and Conditions are accepted
        const checkBoxInput = screen
          .getByTestId(DATA_TEST_ID.ACCEPT_TERMS_AND_CONDITIONS_CHECKBOX_CONTAINER)
          .getElementsByTagName("input")[0] as HTMLInputElement;

        await userEvent.click(checkBoxInput);

        // AND the user clicks the accept button
        await userEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_BUTTON));

        // AND the user should be navigated to the login page
        await waitFor(() => {
          expect(useNavigate()).toHaveBeenCalledWith(routerPaths.SENSITIVE_DATA, { replace: true });
        });
      });
    });
  });
});
