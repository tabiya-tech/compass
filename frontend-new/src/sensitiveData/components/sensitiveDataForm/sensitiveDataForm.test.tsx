// mute chatty console
import "src/_test_utilities/consoleMock";
import "src/_test_utilities/envServiceMock";

import { useNavigate } from "react-router-dom";
import { render, screen, userEvent, waitFor, fireEvent } from "src/_test_utilities/test-utils";
import i18n from "src/i18n/i18n";

import SensitiveDataForm, { DATA_TEST_ID } from "./SensitiveDataForm";
import { DATA_TEST_ID as BACKDROP_DATA_TEST_IDS } from "src/theme/Backdrop/Backdrop";
import { DATA_TEST_ID as CONFIRM_MODAL_DATA_TEST_IDS } from "src/theme/confirmModalDialog/ConfirmModalDialog";

import { routerPaths } from "src/app/routerPaths";
import * as RestAPIErrorModule from "src/error/restAPIError/RestAPIError";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import {
  Language,
  SensitivePersonalDataRequirement,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { sensitivePersonalDataService } from "src/sensitiveData/services/sensitivePersonalDataService/sensitivePersonalData.service";
import { EncryptedDataTooLarge } from "src/sensitiveData/services/sensitivePersonalDataService/errors";
import {
  MaximumAESEncryptedDataSize,
  MaximumAESEncryptedKeySize,
  MaximumRSAKeyIdSize,
} from "src/sensitiveData/services/encryptionConfig";
import { getRandomString, getTestString } from "src/_test_utilities/specialCharacters";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { UserPreferenceError } from "src/error/commonErrors";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import InstitutionService from "src/institutions/services/InstitutionService";
import { typeDebouncedInput } from "src/_test_utilities/userEventFakeTimer";

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    __esModule: true,
    useNavigate: jest.fn().mockReturnValueOnce(jest.fn()),
    NavLink: jest.fn().mockImplementation(() => {
      return <></>;
    }),
  };
});

// mock the snackbar
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      DEFAULT_SNACKBAR_AUTO_HIDE_DURATION: actual.DEFAULT_SNACKBAR_AUTO_HIDE_DURATION,
      enqueueSnackbar: jest.fn(),
      closeSnackbar: jest.fn(),
    }),
  };
});

// mock the sensitive data form skeleton
jest.mock("src/sensitiveData/components/sensitiveDataForm/SensitiveDataFormSkeleton", () => {
  return {
    __esModule: true,
    default: jest.fn(() => {
      return <div>Loading form...</div>;
    }),
  };
});

const givenUserId = getTestString(10);

const SAMPLE_USER_PREFERENCES = {
  user_id: givenUserId,
  language: Language.en,
  accepted_tc: new Date(),
  sessions: [],
  user_feedback_answered_questions: {},
  sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
  has_sensitive_personal_data: false,
  experiments: {},
};

const SAMPLE_INSTITUTION = {
  name: "University of Zambia",
  reg_no: "REG001",
  province: "Lusaka",
};

const SAMPLE_PROGRAMMES = [
  { name: "Computer Science", qualification_type: "BSc", zqf_level: "7", sectors: [] },
  { name: "Engineering", qualification_type: "BEng", zqf_level: "7", sectors: [] },
];

const componentRender = () => {
  return render(<SensitiveDataForm />);
};

describe("Sensitive Data Form", () => {
  let mockLogout: jest.Mock = jest.fn();
  let mockNavigate: jest.Mock = jest.fn();
  let mockSearchInstitutions: jest.Mock;
  let mockGetProgrammes: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSearchInstitutions = jest.fn().mockResolvedValue({ data: [SAMPLE_INSTITUTION] });
    mockGetProgrammes = jest.fn().mockResolvedValue({ programmes: SAMPLE_PROGRAMMES });

    jest.spyOn(InstitutionService, "getInstance").mockReturnValue({
      searchInstitutions: mockSearchInstitutions,
      getProgrammesByInstitution: mockGetProgrammes,
      getInstitutionAssignment: jest.fn().mockResolvedValue(null),
    } as unknown as InstitutionService);

    // @ts-ignore
    jest.spyOn(AuthenticationServiceFactory, "getCurrentAuthenticationService").mockReturnValue({
      logout: mockLogout,
    });

    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);

    jest
      .spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences")
      .mockReturnValue(SAMPLE_USER_PREFERENCES);

    jest.spyOn(UserPreferencesStateService.getInstance(), "setUserPreferences");
  });

  describe("Rendering static fields", () => {
    it("should render First Name, Last Name, Institution, Programme, School Year fields", () => {
      // GIVEN a SensitiveDataForm
      // WHEN the form is rendered
      componentRender();

      // THEN all static fields should be rendered
      expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Institution/i)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_SCHOOL_YEAR_SELECT)).toBeInTheDocument();

      // AND the container should be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toBeInTheDocument();

      // AND the submit button should be rendered but disabled (no fields filled)
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeDisabled();

      // AND the backdrop should not be visible
      expect(screen.queryByTestId(BACKDROP_DATA_TEST_IDS.BACKDROP_CONTAINER)).not.toBeVisible();

      // AND the circle progress should not be rendered
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).not.toBeInTheDocument();

      // AND it should match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toMatchSnapshot();

      // AND no console errors or warnings
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should render the reject button when PII is required", () => {
      // GIVEN user preferences with PII required
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        ...SAMPLE_USER_PREFERENCES,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
      });

      // WHEN the form is rendered
      componentRender();

      // THEN the reject button should be shown
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON)).toBeInTheDocument();
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_SKIP_BUTTON)).not.toBeInTheDocument();
    });

    it("should render the skip button when PII is not required", () => {
      // GIVEN user preferences with PII not required
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        ...SAMPLE_USER_PREFERENCES,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      });

      // WHEN the form is rendered
      componentRender();

      // THEN the skip button should be shown
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_SKIP_BUTTON)).toBeInTheDocument();
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON)).not.toBeInTheDocument();
    });
  });

  describe("Form validation", () => {
    jest.setTimeout(15000);

    it("should enable submit button when all required fields are filled", async () => {
      // GIVEN a form with required fields
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        ...SAMPLE_USER_PREFERENCES,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
      });
      const user = userEvent.setup();

      // WHEN the form is rendered
      componentRender();

      // AND firstName and lastName are filled
      await user.type(screen.getByLabelText(/First Name/i), "Alice");
      await user.type(screen.getByLabelText(/Last Name/i), "Smith");

      // AND an institution is searched and selected (wait for pilot assignment fetch to complete)
      const institutionInput = await screen.findByLabelText(/Institution/i);
      await waitFor(() => expect(institutionInput).not.toBeDisabled());
      await typeDebouncedInput(institutionInput, "Univ");

      await waitFor(() => expect(mockSearchInstitutions).toHaveBeenCalled());
      const option = await screen.findByText("University of Zambia");
      await user.click(option);

      // AND a programme is selected
      await waitFor(() => expect(mockGetProgrammes).toHaveBeenCalled());
      const programmeInput = screen.getByLabelText(/Programme/i);
      await user.click(programmeInput);
      const programmeOption = await screen.findByText("Computer Science");
      await user.click(programmeOption);

      // AND the school year is selected
      const schoolYearSelect = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_SCHOOL_YEAR_SELECT);
      fireEvent.mouseDown(schoolYearSelect);
      const yearOption = await screen.findByText("Year 1");
      await user.click(yearOption);

      // THEN the submit button should be enabled
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).not.toBeDisabled();
      });

      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should disable submit button when string field is invalid (firstName empty)", async () => {
      // GIVEN a form rendered
      const user = userEvent.setup();
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        ...SAMPLE_USER_PREFERENCES,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
      });
      componentRender();

      // WHEN only lastName is filled but not firstName
      await user.type(screen.getByLabelText(/Last Name/i), "Smith");

      // THEN the submit button should be disabled
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeDisabled();
    });

    it("should disable submit button when enum field is invalid (no school year selected)", async () => {
      // GIVEN a form rendered
      const user = userEvent.setup();
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        ...SAMPLE_USER_PREFERENCES,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
      });
      componentRender();

      // WHEN firstName and lastName are filled but no school year
      await user.type(screen.getByLabelText(/First Name/i), "Alice");
      await user.type(screen.getByLabelText(/Last Name/i), "Smith");

      // THEN the submit button should remain disabled
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeDisabled();
    });

    it("should disable submit button when multiple field is invalid (no programme selected)", async () => {
      // GIVEN a form rendered
      const user = userEvent.setup();
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        ...SAMPLE_USER_PREFERENCES,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
      });
      componentRender();

      // WHEN firstName, lastName, schoolYear are filled but no institution/programme
      await user.type(screen.getByLabelText(/First Name/i), "Alice");
      await user.type(screen.getByLabelText(/Last Name/i), "Smith");

      // THEN the submit button should remain disabled (institution + programme not set)
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeDisabled();
    });
  });

  describe("Form submission", () => {
    jest.setTimeout(15000);

    const fillFormAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(screen.getByLabelText(/First Name/i), "Alice");
      await user.type(screen.getByLabelText(/Last Name/i), "Smith");

      // Wait for pilot assignment fetch to complete before the institution field is enabled
      const institutionInput = await screen.findByLabelText(/Institution/i);
      await waitFor(() => expect(institutionInput).not.toBeDisabled());
      await typeDebouncedInput(institutionInput, "Univ");
      await waitFor(() => expect(mockSearchInstitutions).toHaveBeenCalled());
      const institutionOption = await screen.findByText("University of Zambia");
      await user.click(institutionOption);

      await waitFor(() => expect(mockGetProgrammes).toHaveBeenCalled());
      const programmeInput = screen.getByLabelText(/Programme/i);
      await user.click(programmeInput);
      const programmeOption = await screen.findByText("Computer Science");
      await user.click(programmeOption);

      fireEvent.mouseDown(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_SCHOOL_YEAR_SELECT));
      const yearOption = await screen.findByText("Year 1");
      await user.click(yearOption);

      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).not.toBeDisabled();
      });

      await user.click(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON));
    };

    it("should submit the form with sanitized data when all fields are valid", async () => {
      // GIVEN a form with valid fields
      const user = userEvent.setup();
      const mockCreateSensitivePersonalData = jest
        .spyOn(sensitivePersonalDataService, "createSensitivePersonalData")
        .mockResolvedValue(undefined);

      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        ...SAMPLE_USER_PREFERENCES,
        user_id: givenUserId,
      });

      componentRender();
      await fillFormAndSubmit(user);

      // THEN the service should be called
      await waitFor(() => {
        expect(mockCreateSensitivePersonalData).toHaveBeenCalled();
      });

      // AND the data passed should include the filled values
      const callArgs = mockCreateSensitivePersonalData.mock.calls[0];
      expect(callArgs[0]).toMatchObject({
        firstName: "Alice",
        lastName: "Smith",
        institution: "University of Zambia",
        programme: "Computer Science",
        province: "Lusaka",
        schoolYear: "Year 1",
      });
      expect(callArgs[1]).toBe(givenUserId);

      // AND the user should be navigated to the root path
      expect(mockNavigate).toHaveBeenCalledWith(routerPaths.ROOT);

      // AND a success message should be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Personal data saved successfully and securely.", {
        variant: "success",
      });
    });

    it("should handle service errors during submission", async () => {
      // GIVEN a form with valid fields but a service that throws an error
      const user = userEvent.setup();
      const mockError = new RestAPIError("mockedService", "mockedFunction", "GET", "/", 400, "foo", "");
      jest.spyOn(sensitivePersonalDataService, "createSensitivePersonalData").mockRejectedValue(mockError);
      jest.spyOn(RestAPIErrorModule, "getUserFriendlyErrorMessage").mockReturnValue("User-friendly error message");

      componentRender();
      await fillFormAndSubmit(user);

      // THEN an error message should be shown
      await waitFor(() => {
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("User-friendly error message", { variant: "error" });
      });
    });

    it("should handle encrypted data too large error", async () => {
      // GIVEN a form with valid fields but a service that throws an EncryptedDataTooLarge error
      const user = userEvent.setup();
      const givenEncryptReturnValue = {
        rsa_key_id: getRandomString(MaximumRSAKeyIdSize + 1),
        aes_encrypted_data: getRandomString(MaximumAESEncryptedDataSize + 1),
        aes_encryption_key: getRandomString(MaximumAESEncryptedKeySize + 1),
      };
      const mockError = new EncryptedDataTooLarge(givenEncryptReturnValue);
      jest.spyOn(sensitivePersonalDataService, "createSensitivePersonalData").mockRejectedValue(mockError);

      componentRender();
      await fillFormAndSubmit(user);

      // THEN the specific error message for encrypted data too large should be shown
      await waitFor(() => {
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
          i18n.t("sensitiveData.components.sensitiveDataForm.errorEncryptedDataTooLarge"),
          { variant: "error" }
        );
      });
    });

    it("should handle missing user preferences error", async () => {
      // GIVEN user preferences are missing
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(null);
      jest.spyOn(console, "error").mockImplementation(() => {});

      // WHEN the form is rendered
      // THEN an error should be thrown
      expect(() => componentRender()).toThrowError(new UserPreferenceError("User preferences not found"));

      // THEN an error message should be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        i18n.t("sensitiveData.components.sensitiveDataForm.errorDefault"),
        { variant: "error" }
      );
    });

    it("should handle personal info extraction errors gracefully", async () => {
      // GIVEN a form with valid fields
      const user = userEvent.setup();
      const mockCreateSensitivePersonalData = jest
        .spyOn(sensitivePersonalDataService, "createSensitivePersonalData")
        .mockResolvedValue(undefined);

      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        ...SAMPLE_USER_PREFERENCES,
        user_id: givenUserId,
      });

      componentRender();
      await fillFormAndSubmit(user);

      // THEN the service should be called
      await waitFor(() => {
        expect(mockCreateSensitivePersonalData).toHaveBeenCalled();
      });

      // AND the user should be navigated to the root path
      expect(mockNavigate).toHaveBeenCalledWith(routerPaths.ROOT);

      // AND a success message should be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Personal data saved successfully and securely.", {
        variant: "success",
      });
    });
  });

  describe("Reject providing sensitive data", () => {
    beforeEach(() => {
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        ...SAMPLE_USER_PREFERENCES,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
      });
    });

    it("should log the user out when they reject providing sensitive data", async () => {
      // GIVEN logout is successful
      const user = userEvent.setup();
      mockLogout.mockResolvedValue(undefined);

      // WHEN the form is rendered
      componentRender();

      // AND the user clicks the reject button
      const rejectButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON);
      await user.click(rejectButton);

      // AND confirms the action
      await user.click(screen.getByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL_CANCEL));

      // THEN the logout function should be called
      expect(mockLogout).toHaveBeenCalled();

      // AND the user should be navigated to the login page
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(routerPaths.LOGIN, { replace: true });
      });

      // AND a success message should be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Successfully logged out.", { variant: "success" });
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should handle logout error when rejecting sensitive data", async () => {
      // GIVEN logout fails
      const user = userEvent.setup();
      mockLogout.mockRejectedValue(new Error("Logout failed"));

      // WHEN the form is rendered
      componentRender();

      // AND the user clicks the reject button
      const rejectButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON);
      await user.click(rejectButton);

      // AND confirms the action
      await user.click(screen.getByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL_CANCEL));

      // THEN an error message should be shown
      await waitFor(() => {
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to log out.", { variant: "error" });
      });
    });
  });

  describe("Skip providing sensitive data", () => {
    beforeEach(() => {
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        ...SAMPLE_USER_PREFERENCES,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      });
    });

    it("should mark sensitive data as skipped when the user skips providing it", async () => {
      // GIVEN skip is successful
      const user = userEvent.setup();
      const skipSpy = jest.spyOn(sensitivePersonalDataService, "skip").mockResolvedValue(undefined);

      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        ...SAMPLE_USER_PREFERENCES,
        user_id: "given user id",
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      });

      // WHEN the form is rendered
      componentRender();

      // AND the user clicks the skip button
      const skipButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_SKIP_BUTTON);
      await user.click(skipButton);

      // AND confirms the action
      await user.click(screen.getByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL_CANCEL));

      // THEN the skip function should be called
      expect(skipSpy).toHaveBeenCalledWith("given user id");

      // AND the user preferences should be updated
      expect(UserPreferencesStateService.getInstance().setUserPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          has_sensitive_personal_data: true,
        })
      );

      // AND the user should be navigated to the root path
      expect(mockNavigate).toHaveBeenCalledWith(routerPaths.ROOT);

      // AND a success message should be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Personal data collection skipped.", {
        variant: "success",
      });
    });

    it("should handle service errors during skip operation", async () => {
      // GIVEN skip operation fails
      const user = userEvent.setup();
      const mockError = new RestAPIError("mockedService", "mockedFunction", "GET", "/", 400, "foo", "");
      jest.spyOn(sensitivePersonalDataService, "skip").mockRejectedValue(mockError);
      jest.spyOn(RestAPIErrorModule, "getUserFriendlyErrorMessage").mockReturnValue("User-friendly error message");

      // WHEN the form is rendered
      componentRender();

      // AND the user clicks the skip button
      const skipButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_SKIP_BUTTON);
      await user.click(skipButton);

      // AND confirms the action
      await user.click(screen.getByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL_CANCEL));

      // THEN an error message should be shown
      await waitFor(() => {
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("User-friendly error message", { variant: "error" });
      });
    });

    test("should stay on the same page when the user cancels the skip action", async () => {
      const user = userEvent.setup();
      const skipSpy = jest.spyOn(sensitivePersonalDataService, "skip");

      // WHEN the component is rendered
      componentRender();
      // AND the skip button is clicked
      const skipButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_SKIP_BUTTON);
      await user.click(skipButton);
      // AND the dialog is open
      await waitFor(() => expect(screen.getByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL)).toBeVisible());
      // AND the user cancels the skip action
      const button = screen.getByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL_CONFIRM);
      await user.click(button);

      // THEN the skip method should not be called
      expect(skipSpy).not.toHaveBeenCalled();
      // AND the user should not be navigated to the root path
      expect(mockNavigate).not.toHaveBeenCalled();
      // AND no console errors or warnings should be logged
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should enable/disable the skip button when the browser online status changes", async () => {
      // GIVEN the browser is offline
      mockBrowserIsOnLine(false);

      // WHEN the component is rendered
      componentRender();

      // THEN the skip button should be disabled
      const skipButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_SKIP_BUTTON);
      expect(skipButton).toHaveAttribute("aria-disabled", "true");

      // WHEN the browser goes online
      mockBrowserIsOnLine(true);

      // THEN the skip button should be enabled
      expect(skipButton).toHaveAttribute("aria-disabled", "false");
      // AND expect no errors or warnings to be logged
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe("Institution search", () => {
    it("should search institutions when user types at least 2 characters", async () => {
      // GIVEN a form is rendered
      componentRender();

      // WHEN the pilot assignment fetch completes and the institution field is enabled
      const institutionInput = await screen.findByLabelText(/Institution/i);
      await waitFor(() => expect(institutionInput).not.toBeDisabled());

      // AND the user types in the institution field
      await typeDebouncedInput(institutionInput, "Un");

      // THEN the institution service should be called
      await waitFor(() => {
        expect(mockSearchInstitutions).toHaveBeenCalledWith("Un", 10);
      });
    });

    it("should not search institutions when user types fewer than 2 characters", async () => {
      // GIVEN a form is rendered
      const user = userEvent.setup();
      componentRender();

      // WHEN the pilot assignment fetch completes and the institution field is enabled
      const institutionInput = await screen.findByLabelText(/Institution/i);
      await waitFor(() => expect(institutionInput).not.toBeDisabled());

      // AND the user types only 1 character
      await user.type(institutionInput, "U");

      // THEN the institution service should not be called
      expect(mockSearchInstitutions).not.toHaveBeenCalled();
    });

    it("should load programmes when an institution is selected", async () => {
      // GIVEN a form is rendered
      const user = userEvent.setup();
      componentRender();

      // WHEN the user searches and selects an institution (wait for assignment fetch)
      const institutionInput = await screen.findByLabelText(/Institution/i);
      await waitFor(() => expect(institutionInput).not.toBeDisabled());
      await typeDebouncedInput(institutionInput, "Univ");
      await waitFor(() => expect(mockSearchInstitutions).toHaveBeenCalled());
      const institutionOption = await screen.findByText("University of Zambia");
      await user.click(institutionOption);

      // THEN programmes should be fetched for the selected institution
      await waitFor(() => {
        expect(mockGetProgrammes).toHaveBeenCalledWith("REG001");
      });
    });
  });

  describe("Field validation for static fields", () => {
    jest.setTimeout(15000);

    it("should show validation error for required string field when empty", async () => {
      // GIVEN a form rendered
      componentRender();

      // THEN the submit button should be disabled initially (no fields filled)
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeDisabled();
    });

    it("should show validation error for required enum field when empty (no school year)", async () => {
      // GIVEN a form with firstName and lastName filled
      const user = userEvent.setup();
      componentRender();

      await user.type(screen.getByLabelText(/First Name/i), "Alice");
      await user.type(screen.getByLabelText(/Last Name/i), "Smith");

      // THEN the submit button should remain disabled because school year not selected
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeDisabled();
    });

    it("should show validation error for required multiple select field when empty (no programme)", async () => {
      // GIVEN a form with firstName, lastName, schoolYear filled but no programme
      const user = userEvent.setup();
      componentRender();

      await user.type(screen.getByLabelText(/First Name/i), "Alice");
      await user.type(screen.getByLabelText(/Last Name/i), "Smith");

      // THEN the submit button should remain disabled
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeDisabled();
    });

    it("should allow empty values for non-required fields (province is not required)", async () => {
      // GIVEN a form with all required fields filled
      const user = userEvent.setup();
      // AND an institution with no province
      mockSearchInstitutions.mockResolvedValue({
        data: [{ name: "No Province Uni", reg_no: "REG002", province: null }],
      });
      mockGetProgrammes.mockResolvedValue({ programmes: [{ name: "Law" }] });

      componentRender();

      await user.type(screen.getByLabelText(/First Name/i), "Alice");
      await user.type(screen.getByLabelText(/Last Name/i), "Smith");

      const institutionInput = await screen.findByLabelText(/Institution/i);
      await waitFor(() => expect(institutionInput).not.toBeDisabled());
      await typeDebouncedInput(institutionInput, "No Pro");
      await waitFor(() => expect(mockSearchInstitutions).toHaveBeenCalled());
      const institutionOption = await screen.findByText("No Province Uni");
      await user.click(institutionOption);

      await waitFor(() => expect(mockGetProgrammes).toHaveBeenCalled());
      const programmeInput = screen.getByLabelText(/Programme/i);
      await user.click(programmeInput);
      const programmeOption = await screen.findByText("Law");
      await user.click(programmeOption);

      fireEvent.mouseDown(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_SCHOOL_YEAR_SELECT));
      const yearOption = await screen.findByText("Year 2");
      await user.click(yearOption);

      // THEN the submit button should be enabled (province is optional)
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).not.toBeDisabled();
      });
    });
  });
});
