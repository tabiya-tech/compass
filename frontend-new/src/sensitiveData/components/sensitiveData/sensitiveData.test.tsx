// mute chatty console
import "src/_test_utilities/consoleMock";

import SensitiveData, { DATA_TEST_ID } from "./SensitiveData";

import { DATA_TEST_ID as APPROVE_MODAL_DATA_TES_IDS } from "src/theme/ApproveModal/ApproveModal"

import { waitFor } from "@testing-library/react";
import { routerPaths } from "src/app/routerPaths";
import { HashRouter, useNavigate } from "react-router-dom";
import { ServiceError } from "src/error/ServiceError/ServiceError";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { fireEvent, render, screen } from "src/_test_utilities/test-utils";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import {
  Language,
  SensitivePersonalDataRequirement,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { Gender, SensitivePersonalData } from "src/sensitiveData/services/sensitivePersonalDataService/types";
import { sensitivePersonalDataService } from "src/sensitiveData/services/sensitivePersonalDataService/sensitivePersonalData.service";

const componentRender = () => {
  return render(
    <HashRouter>
      <SensitiveData />
    </HashRouter>
  );
};

jest.mock("src/auth/services/Authentication.service.factory", () => ({
  getCurrentAuthenticationService: jest.fn(),
}));

const SAMPLE_SENSITIVE_PERSONAL_DATA = {
  first_name: "foo",
  last_name: "bar",
  contact_email: "foo",
  phone_number: "bar",
  address: "foo",
  gender: Gender.PREFER_NOT_TO_SAY,
};

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

function fillTheForm(data: SensitivePersonalData) {
  function fillInput(inputTestId: string, value: string) {
    const input = screen.getByTestId(inputTestId)!;
    fireEvent.change(input, { target: { value } });
  }

  fillInput(DATA_TEST_ID.SENSITIVE_DATA_FORM_FIRST_NAME_INPUT, data.first_name);
  fillInput(DATA_TEST_ID.SENSITIVE_DATA_FORM_LAST_NAME_INPUT, data.last_name);
  fillInput(DATA_TEST_ID.SENSITIVE_DATA_FORM_CONTACT_EMAIL_INPUT, data.contact_email);
  fillInput(DATA_TEST_ID.SENSITIVE_DATA_FORM_PHONE_NUMBER_INPUT, data.phone_number);
  fillInput(DATA_TEST_ID.SENSITIVE_DATA_FORM_ADDRESS_INPUT, data.address);
}

describe("Sensitive Data", () => {
  describe("render tests", () => {
    it("should render the component with all elements", () => {
      // GIVEN a component is rendered
      componentRender();

      // THEN the component should render without error
      expect(console.log).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();

      // AND the container should be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toBeInTheDocument();

      // AND all the inputs should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_FIRST_NAME_INPUT)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_LAST_NAME_INPUT)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_CONTACT_EMAIL_INPUT)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_PHONE_NUMBER_INPUT)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_GENDER_INPUT)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_ADDRESS_INPUT)).toBeInTheDocument();

      // AND the submit button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeInTheDocument();

      // AND it should match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toMatchSnapshot();
    });
  });

  describe("action tests: reject providing sensitive user data", () => {
    let mockLogout: jest.Mock;
    let mockEnqueueSnackbar: jest.Mock;
    let mockNavigate: jest.Mock;

    beforeEach(() => {
      mockLogout = jest.fn();
      mockEnqueueSnackbar = jest.fn();
      mockNavigate = jest.fn();

      (AuthenticationServiceFactory.getCurrentAuthenticationService as jest.Mock).mockReturnValue({
        logout: mockLogout,
      });
      (useSnackbar as jest.Mock).mockReturnValue({ enqueueSnackbar: mockEnqueueSnackbar });
      (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should successfully log user out if the user doesn't submit sensitive personal data", async () => {
      // GIVEN logout is successful
      mockLogout.mockResolvedValueOnce(undefined);

      // AND the component is rendered
      componentRender();

      // WHEN the reject button is clicked
      const rejectButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON);
      fireEvent.click(rejectButton);

      // AND the user approves the action
      fireEvent.click(screen.getByTestId(APPROVE_MODAL_DATA_TES_IDS.APPROVE_MODEL_CONFIRM))

      // THEN logout function should be called
      expect(mockLogout).toHaveBeenCalledTimes(1);

      // AND user should be navigated to log in
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(routerPaths.LOGIN, { replace: true });
      });

      // AND success snackbar should be displayed
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Successfully logged out.", { variant: "success" });
    });

    it("should show an error if logging out the user fails because an error is thrown", async () => {
      // GIVEN logout fails
      const error = new Error("Logout failed");
      mockLogout.mockRejectedValueOnce(error);

      // WHEN the component is rendered
      componentRender();

      // AND the reject button is clicked
      const rejectButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON);
      fireEvent.click(rejectButton);

      // AND the user approves the action
      fireEvent.click(screen.getByTestId(APPROVE_MODAL_DATA_TES_IDS.APPROVE_MODEL_CONFIRM))

      // THEN logout should be called
      expect(mockLogout).toHaveBeenCalledTimes(1);

      // AND user should not be navigated to log in
      expect(mockNavigate).not.toHaveBeenCalled();

      // AND error should be logged
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith("Failed to log out", error);
      });

      // AND error snackbar should be displayed
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Failed to log out.", { variant: "error" });
    });
  });

  describe("action tests: submit sensitive personal data", () => {
    let mockEnqueueSnackbar: jest.Mock;
    let mockNavigate: jest.Mock;
    let mockSetUserPreferences: jest.Mock;
    let mockCreateSensitivePersonalData: jest.Mock;
    let givenUserId = "givenUserId";

    beforeEach(() => {
      mockEnqueueSnackbar = jest.fn();
      mockNavigate = jest.fn();
      mockSetUserPreferences = jest.fn();
      mockCreateSensitivePersonalData = jest.fn();

      jest.spyOn(authenticationStateService.getInstance(), "getUser").mockReturnValue({
        id: givenUserId,
        email: "foo",
        name: "bar",
      });

      jest.spyOn(userPreferencesStateService, "getUserPreferences").mockReturnValue({
        user_id: givenUserId,
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [],
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        has_sensitive_personal_data: false,
      });

      jest.spyOn(userPreferencesStateService, "setUserPreferences").mockImplementation(mockSetUserPreferences);
      jest
        .spyOn(sensitivePersonalDataService, "createSensitivePersonalData")
        .mockImplementation(mockCreateSensitivePersonalData);

      (useSnackbar as jest.Mock).mockReturnValue({ enqueueSnackbar: mockEnqueueSnackbar });

      (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should save sensitive personal data successfully and navigate to the root path", async () => {
      // GIVEN mockCreateSensitivePersonalData is successful
      mockCreateSensitivePersonalData.mockResolvedValueOnce(undefined);

      // AND user provides some sensitive personal data
      const givenSensitivePersonalData = SAMPLE_SENSITIVE_PERSONAL_DATA;

      // AND the component is successfully rendered
      componentRender();

      // WHEN The form inputs are filled
      fillTheForm(givenSensitivePersonalData);

      // AND the submit button is clicked
      const button = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      expect(button).toBeInTheDocument();
      expect(button).toBeEnabled();
      fireEvent.click(button);

      // AND the async operations are awaited
      await Promise.resolve();

      // THEN save sensitive personal data should be called with the correct arguments.
      await waitFor(() => {
        expect(mockCreateSensitivePersonalData).toHaveBeenCalledWith(givenSensitivePersonalData, givenUserId);
      });

      // AND userPreferences should be updated
      expect(mockSetUserPreferences).toHaveBeenCalledWith({
        ...userPreferencesStateService.getUserPreferences(),
        has_sensitive_personal_data: true,
      });

      // AND user should be navigated to the root path
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Personal data saved successfully and securely.", {
        variant: "success",
      });

      expect(mockNavigate).toHaveBeenCalledWith(routerPaths.ROOT);
    });

    it("should handle service error and display error in snackbar", async () => {
      // GIVEN create sensitive personal data fails
      const serviceError = new ServiceError("foo", "bar", "foo", "bar", 201, "foo", "foo");
      mockCreateSensitivePersonalData.mockRejectedValue(serviceError as never);

      // AND given sensitive personal data
      const givenData = SAMPLE_SENSITIVE_PERSONAL_DATA;

      // AND Component is rendered
      componentRender();

      // WHEN The form inputs are filled
      fillTheForm(givenData);

      // AND the submit button is clicked
      const button = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      fireEvent.click(button);

      // AND the async operations are awaited
      await Promise.resolve();

      // THEN create sensitive personal data should be called with the correct arguments.
      expect(mockCreateSensitivePersonalData).toHaveBeenCalledWith(givenData, givenUserId);

      // AND userPreferences should not be updated
      expect(mockSetUserPreferences).not.toHaveBeenCalled();
    });

    it("should handle unexpected errors and display error snackbar", async () => {
      // GIVEN get user preferences throws an unexpected error new Error("Unexpected error");
      jest.spyOn(userPreferencesStateService, "getUserPreferences").mockReturnValue({
        user_id: givenUserId,
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [],
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        has_sensitive_personal_data: false,
      });

      // AND create sensitive personal data throws an unexpected error
      const unexpectedError = new Error("Unexpected error");
      mockCreateSensitivePersonalData.mockRejectedValue(unexpectedError as never);

      // AND given some user sensitive personal data
      const givenData = SAMPLE_SENSITIVE_PERSONAL_DATA;

      // AND Component is rendered
      componentRender();

      // WHEN The form inputs are filled
      fillTheForm(givenData);

      // AND the submit button is clicked
      const button = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      fireEvent.click(button);

      // AND the async operations are awaited
      await Promise.resolve();

      // THEN createSensitivePersonalData should not be called
      expect(mockCreateSensitivePersonalData).toHaveBeenCalledWith(givenData, givenUserId);
      expect(mockSetUserPreferences).not.toHaveBeenCalled();

      // AND error snackbar should be displayed
      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Failed to save personal data: Unexpected error", {
          variant: "error",
        });
      })

      // AND error should be logged
      expect(console.error).toHaveBeenCalledWith("Failed to save personal data", unexpectedError);
    });

    it("should not proceed if userPreferences is undefined", async () => {
      // GIVEN authedUser and userPreferences are undefined
      jest.spyOn(userPreferencesStateService, "getUserPreferences").mockReturnValue(null);

      // AND given some user sensitive personal data
      const givenData = SAMPLE_SENSITIVE_PERSONAL_DATA;

      // AND Component is rendered
      componentRender();

      // WHEN The form inputs are filled
      fillTheForm(givenData);

      // AND the submit button is clicked
      const button = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      fireEvent.click(button);

      await Promise.resolve();

      // THEN create sensitive personal data should not be called
      expect(mockCreateSensitivePersonalData).not.toHaveBeenCalled();
      expect(mockSetUserPreferences).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
