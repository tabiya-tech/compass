// mute chatty console
import "src/_test_utilities/consoleMock";
import "src/_test_utilities/envServiceMock";

import { useNavigate } from "react-router-dom";
import { act, render, screen, userEvent, waitFor } from "src/_test_utilities/test-utils";
import { getRandomString, getTestString } from "src/_test_utilities/specialCharacters";
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
import {
  sensitivePersonalDataService,
} from "src/sensitiveData/services/sensitivePersonalDataService/sensitivePersonalData.service";
import { EncryptedDataTooLarge } from "src/sensitiveData/services/sensitivePersonalDataService/errors";
import { FieldDefinition, FieldType } from "./config/types";
import * as useFieldsConfigModule from "./config/useFieldsConfig";
import StringField from "./components/StringField";
import EnumField from "./components/EnumField";
import MultipleSelectField from "./components/MultipleSelectField";
import {
  MaximumAESEncryptedDataSize,
  MaximumAESEncryptedKeySize,
  MaximumRSAKeyIdSize,
} from "src/sensitiveData/services/encryptionConfig";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { UserPreferenceError } from "src/error/commonErrors";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";

// Mock the field components
jest.mock("./components/StringField", () => {
  return {
    __esModule: true,
    default: jest.fn((props: any) => {
      return <div data-testid={props.dataTestId}>StringField: {props.field.name}</div>;
    }),
  };
});

jest.mock("./components/EnumField", () => {
  return {
    __esModule: true,
    default: jest.fn((props: any) => {
      return <div data-testid={props.dataTestId}>EnumField: {props.field.name}</div>;
    }),
  };
});

jest.mock("./components/MultipleSelectField", () => {
  return {
    __esModule: true,
    default: jest.fn((props: any) => {
      return <div data-testid={props.dataTestId}>MultipleField: {props.field.name}</div>;
    }),
  };
});

jest.mock("@mui/material", () => ({
  ...jest.requireActual("@mui/material"),
  MenuItem: jest.fn().mockImplementation((props) => {
    return (
      <option value={props.value} data-testid={props["data-testid"]}>
        {props.children}
      </option>
    );
  }),
  Select: jest.fn().mockImplementation((props) => {
    // @ts-ignore
    return (
      <select data-testid={props["data-testid"]} onChange={props.onChange}>
        {props.children}
      </select>
    );
  }),
}));

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

// Sample field configurations for testing
const SAMPLE_STRING_FIELD: FieldDefinition = {
  name: "field1",
  dataKey: "field1_key",
  type: FieldType.String,
  required: true,
  label: "Field 1",
  questionText: "Enter Field 1",
};

const SAMPLE_ENUM_FIELD: FieldDefinition = {
  name: "field2",
  dataKey: "field2_key",
  type: FieldType.Enum,
  required: true,
  label: "Field 2",
  values: ["option1", "option2", "option3"],
};

const SAMPLE_MULTIPLE_FIELD: FieldDefinition = {
  name: "field3",
  dataKey: "field3_key",
  type: FieldType.MultipleSelect,
  required: true,
  label: "Field 3",
  values: ["option1", "option2", "option3", "option4"],
};

const SAMPLE_FIELDS = [SAMPLE_STRING_FIELD, SAMPLE_ENUM_FIELD, SAMPLE_MULTIPLE_FIELD];

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

const componentRender = () => {
  return render(<SensitiveDataForm />);
};

describe("Sensitive Data Form", () => {
  let mockLogout: jest.Mock = jest.fn();
  let mockNavigate: jest.Mock = jest.fn();
  let useFieldsConfigSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the useFieldsConfig hook to return our sample fields
    useFieldsConfigSpy = jest.spyOn(useFieldsConfigModule, "useFieldsConfig").mockReturnValue({
      fields: SAMPLE_FIELDS,
      loading: false,
      error: null,
    });

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

  describe("Rendering fields based on configuration", () => {
    it("should render a StringField when configuration contains a string field", () => {
      // GIVEN a SensitiveDataForm with a configuration containing a string field
      useFieldsConfigSpy.mockReturnValue({
        fields: [SAMPLE_STRING_FIELD],
        loading: false,
        error: null,
      });
      // AND the user preferences state service is mocked to return user preferences with PII required
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      });

      // WHEN the form is rendered
      componentRender();

      // THEN a StringField component should be rendered with the correct props
      const fieldTestId = `sensitive-data-form-${SAMPLE_STRING_FIELD.name.toLowerCase()}-input-ab02918f-d559-47ba-9662-ea6b3a3606d1`;
      expect(screen.getByTestId(fieldTestId)).toBeInTheDocument();
      expect(screen.getByText(`StringField: ${SAMPLE_STRING_FIELD.name}`)).toBeInTheDocument();

      // AND the container should be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toBeInTheDocument();

      // AND the submit button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeInTheDocument();

      // AND the reject button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON)).toBeInTheDocument();

      // AND the approval modal should not be rendered
      expect(screen.queryByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL)).not.toBeInTheDocument();

      // AND the backdrop should not be rendered
      expect(screen.queryByTestId(BACKDROP_DATA_TEST_IDS.BACKDROP_CONTAINER)).not.toBeVisible();

      // AND the circle progress should not be rendered
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).not.toBeInTheDocument();

      // AND it should match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toMatchSnapshot();

      // THEN the component should render without error
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should render an EnumField when configuration contains an enum field", () => {
      // GIVEN a SensitiveDataForm with a configuration containing an enum field
      useFieldsConfigSpy.mockReturnValue({
        fields: [SAMPLE_ENUM_FIELD],
        loading: false,
        error: null,
      });
      // AND the user preferences state service is mocked to return user preferences with PII required
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      });

      // WHEN the form is rendered
      componentRender();

      // THEN an EnumField component should be rendered with the correct props
      const fieldTestId = `sensitive-data-form-${SAMPLE_ENUM_FIELD.name.toLowerCase()}-input-ab02918f-d559-47ba-9662-ea6b3a3606d1`;
      expect(screen.getByTestId(fieldTestId)).toBeInTheDocument();
      expect(screen.getByText(`EnumField: ${SAMPLE_ENUM_FIELD.name}`)).toBeInTheDocument();

      // AND the container should be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toBeInTheDocument();

      // AND the submit button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeInTheDocument();

      // AND the reject button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON)).toBeInTheDocument();

      // AND the approval modal should not be rendered
      expect(screen.queryByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL)).not.toBeInTheDocument();

      // AND the backdrop should not be rendered
      expect(screen.queryByTestId(BACKDROP_DATA_TEST_IDS.BACKDROP_CONTAINER)).not.toBeVisible();

      // AND the circle progress should not be rendered
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).not.toBeInTheDocument();

      // AND it should match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toMatchSnapshot();

      // THEN the component should render without error
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should render a MultipleField when configuration contains a multiple field", () => {
      // GIVEN a SensitiveDataForm with a configuration containing a multiple field
      useFieldsConfigSpy.mockReturnValue({
        fields: [SAMPLE_MULTIPLE_FIELD],
        loading: false,
        error: null,
      });
      // AND the user preferences state service is mocked to return user preferences with PII required
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      });

      // WHEN the form is rendered
      componentRender();

      // THEN a MultipleField component should be rendered with the correct props
      const fieldTestId = `sensitive-data-form-${SAMPLE_MULTIPLE_FIELD.name.toLowerCase()}-input-ab02918f-d559-47ba-9662-ea6b3a3606d1`;
      expect(screen.getByTestId(fieldTestId)).toBeInTheDocument();
      expect(screen.getByText(`MultipleField: ${SAMPLE_MULTIPLE_FIELD.name}`)).toBeInTheDocument();

      // AND the container should be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toBeInTheDocument();

      // AND the submit button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeInTheDocument();

      // AND the reject button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON)).toBeInTheDocument();

      // AND the approval modal should not be rendered
      expect(screen.queryByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL)).not.toBeInTheDocument();

      // AND the backdrop should not be rendered
      expect(screen.queryByTestId(BACKDROP_DATA_TEST_IDS.BACKDROP_CONTAINER)).not.toBeVisible();

      // AND the circle progress should not be rendered
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).not.toBeInTheDocument();

      // AND it should match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toMatchSnapshot();

      // THEN the component should render without error
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should render a complex form with multiple field types", () => {
      // GIVEN a SensitiveDataForm with a configuration containing multiple field types
      useFieldsConfigSpy.mockReturnValue({
        fields: SAMPLE_FIELDS,
        loading: false,
        error: null,
      });
      // AND the user preferences state service is mocked to return user preferences with PII required
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      });

      // WHEN the form is rendered
      componentRender();

      // THEN all field components should be rendered with the correct props
      SAMPLE_FIELDS.forEach((field) => {
        const fieldTestId = `sensitive-data-form-${field.name.toLowerCase()}-input-ab02918f-d559-47ba-9662-ea6b3a3606d1`;
        expect(screen.getByTestId(fieldTestId)).toBeInTheDocument();
      });

      // AND the container should be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toBeInTheDocument();

      // AND the submit button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeInTheDocument();

      // AND the reject button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON)).toBeInTheDocument();

      // AND the approval modal should not be rendered
      expect(screen.queryByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL)).not.toBeInTheDocument();

      // AND the backdrop should not be rendered
      expect(screen.queryByTestId(BACKDROP_DATA_TEST_IDS.BACKDROP_CONTAINER)).not.toBeVisible();

      // AND the circle progress should not be rendered
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).not.toBeInTheDocument();

      // AND it should match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toMatchSnapshot();

      // THEN the component should render without error
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should handle empty configuration gracefully", () => {
      // GIVEN a SensitiveDataForm with an empty configuration
      useFieldsConfigSpy.mockReturnValue({
        fields: [],
        loading: false,
        error: null,
      });
      // AND the user preferences state service is mocked to return user preferences with PII required
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      });

      // WHEN the form is rendered
      componentRender();

      // THEN no field components should be rendered and no errors should occur
      expect(screen.queryByText(/StringField:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/EnumField:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/MultipleField:/)).not.toBeInTheDocument();

      // AND the form container should still be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toBeInTheDocument();

      // AND the submit button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeInTheDocument();

      // AND the reject button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON)).toBeInTheDocument();

      // AND the approval modal should not be rendered
      expect(screen.queryByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL)).not.toBeInTheDocument();

      // AND the backdrop should not be rendered
      expect(screen.queryByTestId(BACKDROP_DATA_TEST_IDS.BACKDROP_CONTAINER)).not.toBeVisible();

      // AND the circle progress should not be rendered
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).not.toBeInTheDocument();

      // AND it should match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toMatchSnapshot();

      // THEN the component should render without error
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should show loading state while configuration is loading", () => {
      // GIVEN the configuration is still loading
      useFieldsConfigSpy.mockReturnValue({
        fields: [],
        loading: true,
        error: null,
      });
      // AND the user preferences state service is mocked to return user preferences with PII required
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      });

      // WHEN the form is rendered
      componentRender();

      // THEN a loading indicator should be displayed
      expect(screen.getByText("Loading form...")).toBeInTheDocument();

      // AND the container should not be in the document
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).not.toBeInTheDocument();

      // AND the approval modal should not be rendered
      expect(screen.queryByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL)).not.toBeInTheDocument();

      // THEN the component should render without error
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should show error state if configuration failed to load", () => {
      // GIVEN the configuration failed to load
      useFieldsConfigSpy.mockReturnValue({
        fields: [],
        loading: false,
        error: new Error("Failed to load configuration"),
      });
      // AND the user preferences state service is mocked to return user preferences with PII required
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      });

      // WHEN the form is rendered
      componentRender();

      // THEN an error message should be displayed
      expect(screen.getByText("Failed to load form configuration")).toBeInTheDocument();
      expect(screen.getByText("Refresh Page")).toBeInTheDocument();

      // AND the container should be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toBeInTheDocument();

      // AND the approval modal should not be rendered
      expect(screen.queryByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL)).not.toBeInTheDocument();

      // THEN the component should render without error
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe("Form validation", () => {
    it("should enable submit button when all required fields are valid", async () => {
      // GIVEN a form with required fields
      // AND the user preferences state service is mocked to return user preferences with PII required
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      });

      // WHEN the form is rendered
      componentRender();

      // WHEN all fields report valid values
      // Get the onChange callbacks from the most recent calls to each component
      const stringFieldProps = (StringField as jest.Mock).mock.calls.at(-1)[0];
      const enumFieldProps = (EnumField as jest.Mock).mock.calls.at(-1)[0];
      const multipleFieldProps = (MultipleSelectField as jest.Mock).mock.calls.at(-1)[0];

      // Trigger the onChange callbacks with valid values
      act(() => {
        stringFieldProps.onChange("test value", true);
      });

      act(() => {
        enumFieldProps.onChange("option1", true);
      });

      act(() => {
        multipleFieldProps.onChange(["option1", "option2"], true);
      });

      // THEN the submit button should be enabled after validation
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).not.toBeDisabled();
      });

      // AND the container should be in the document
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toBeInTheDocument();

      // AND the submit button should be rendered
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeInTheDocument();

      // AND the reject button should be rendered
      const rejectButton = screen.getByText("No, thank you");
      expect(rejectButton).toBeInTheDocument();

      // AND the approval modal should not be rendered
      expect(screen.queryByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL)).not.toBeInTheDocument();

      // AND the backdrop should not be rendered
      expect(screen.queryByTestId(BACKDROP_DATA_TEST_IDS.BACKDROP_CONTAINER)).not.toBeVisible();

      // AND the circle progress should not be rendered
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).not.toBeInTheDocument();

      // AND it should match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_CONTAINER)).toMatchSnapshot();

      // THEN the component should render without error
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it.each([
      ["string field is invalid", "StringField", false],
      ["enum field is invalid", "EnumField", false],
      ["multiple field is invalid", "MultipleSelectField", false],
    ])("should disable submit button when %s", async (_, fieldType, isValid) => {
      // GIVEN a form with required fields
      componentRender();

      // Get the onChange callbacks from the most recent calls to each component
      const stringFieldProps = (StringField as jest.Mock).mock.calls.at(-1)[0];
      const enumFieldProps = (EnumField as jest.Mock).mock.calls.at(-1)[0];
      const multipleFieldProps = (MultipleSelectField as jest.Mock).mock.calls.at(-1)[0];

      // Force all fields to be valid to ensure the button is enabled
      act(() => {
        stringFieldProps.onChange("test value", true);
        enumFieldProps.onChange("option1", true);
        multipleFieldProps.onChange(["option1", "option2"], true);
      });

      // Wait for the button to be enabled first
      await waitFor(() => {
        const submitButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
        expect(submitButton).not.toBeDisabled();
      });

      // WHEN one specific field is set to invalid
      act(() => {
        if (fieldType === "StringField") {
          stringFieldProps.onChange("test value", isValid);
        } else if (fieldType === "EnumField") {
          enumFieldProps.onChange("option1", isValid);
        } else if (fieldType === "MultipleSelectField") {
          multipleFieldProps.onChange(["option1", "option2"], isValid);
        }
      });

      // THEN the submit button should be disabled
      await waitFor(() => {
        const submitButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe("Form submission", () => {
    it("should submit the form with sanitized data when all fields are valid", async () => {
      // GIVEN a form with valid fields
      const user = userEvent.setup();
      const mockCreateSensitivePersonalData = jest
        .spyOn(sensitivePersonalDataService, "createSensitivePersonalData")
        .mockResolvedValue(undefined);

      componentRender();

      // WHEN all fields report valid values
      // Get the onChange callbacks from the most recent calls to each component
      const stringFieldProps = (StringField as jest.Mock).mock.calls.at(-1)[0];
      const enumFieldProps = (EnumField as jest.Mock).mock.calls.at(-1)[0];
      const multipleFieldProps = (MultipleSelectField as jest.Mock).mock.calls.at(-1)[0];

      // Trigger the onChange callbacks with valid values
      act(() => {
        stringFieldProps.onChange("test value", true);
        enumFieldProps.onChange("option1", true);
        multipleFieldProps.onChange(["option1", "option2"], true);
      });

      // Wait for the button to be enabled
      await waitFor(() => {
        const submitButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
        expect(submitButton).not.toBeDisabled();
      });

      // AND the user submits the form
      const submitButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);

      // Click the button (no need to mock disabled property as it should be enabled)
      await user.click(submitButton);

      // THEN the service should be called with the correct data
      expect(mockCreateSensitivePersonalData).toHaveBeenCalledWith(
        {
          field1: "test value",
          field2: "option1",
          field3: ["option1", "option2"],
        },
        givenUserId,
        SAMPLE_FIELDS
      );

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

      // WHEN all fields report valid values
      // Get the onChange callbacks from the most recent calls to each component
      const stringFieldProps = (StringField as jest.Mock).mock.calls.at(-1)[0];
      const enumFieldProps = (EnumField as jest.Mock).mock.calls.at(-1)[0];
      const multipleFieldProps = (MultipleSelectField as jest.Mock).mock.calls.at(-1)[0];

      // Trigger the onChange callbacks with valid values
      act(() => {
        stringFieldProps.onChange("test value", true);
        enumFieldProps.onChange("option1", true);
        multipleFieldProps.onChange(["option1", "option2"], true);
      });

      // Wait for the button to be enabled
      await waitFor(() => {
        const submitButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
        expect(submitButton).not.toBeDisabled();
      });

      // AND the user submits the form
      const submitButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      await user.click(submitButton);

      // THEN an error message should be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("User-friendly error message", { variant: "error" });
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

      // WHEN all fields report valid values
      // Get the onChange callbacks from the most recent calls to each component
      const stringFieldProps = (StringField as jest.Mock).mock.calls.at(-1)[0];
      const enumFieldProps = (EnumField as jest.Mock).mock.calls.at(-1)[0];
      const multipleFieldProps = (MultipleSelectField as jest.Mock).mock.calls.at(-1)[0];

      // Trigger the onChange callbacks with valid values
      act(() => {
        stringFieldProps.onChange("test value", true);
        enumFieldProps.onChange("option1", true);
        multipleFieldProps.onChange(["option1", "option2"], true);
      });

      // Wait for the button to be enabled
      await waitFor(() => {
        const submitButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
        expect(submitButton).not.toBeDisabled();
      });

      // AND the user submits the form
      const submitButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      await user.click(submitButton);

      // THEN the specific error message for encrypted data too large should be shown (via i18n)
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        i18n.t("sensitiveData.components.sensitiveDataForm.errorEncryptedDataTooLarge"),
        {
          variant: "error",
        }
      );
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

    it("should handle logout error when rejecting sensitive data", async () => {
      // GIVEN logout fails
      const user = userEvent.setup();
      mockLogout.mockRejectedValue(new Error("Logout failed"));

      // AND user preferences are set to show reject button
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: givenUserId,
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      });

      // WHEN the form is rendered
      componentRender();

      // AND the user clicks the reject button
      const rejectButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON);
      await user.click(rejectButton);

      // AND confirms the action
      await user.click(screen.getByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL_CANCEL));

      // THEN an error message should be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to log out.", { variant: "error" });
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
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("User-friendly error message", { variant: "error" });
    });

    it("should handle YAML configuration parsing errors", async () => {
      // GIVEN the configuration contains invalid YAML
      const mockError = new Error("Failed to parse fields configuration");
      jest.spyOn(useFieldsConfigModule, "useFieldsConfig").mockReturnValue({
        fields: [],
        loading: false,
        error: mockError,
      });

      // WHEN the form is rendered
      componentRender();

      // THEN an error message should be shown
      expect(screen.getByText("Failed to load form configuration")).toBeInTheDocument();
      expect(screen.getByText("Refresh Page")).toBeInTheDocument();
    });

    it("should handle personal info extraction errors gracefully", async () => {
      // GIVEN a form with valid fields
      const user = userEvent.setup();
      const mockCreateSensitivePersonalData = jest
        .spyOn(sensitivePersonalDataService, "createSensitivePersonalData")
        .mockResolvedValue(undefined);

      // AND the form is rendered
      componentRender();

      // WHEN all fields report valid values
      const stringFieldProps = (StringField as jest.Mock).mock.calls.at(-1)[0];
      const enumFieldProps = (EnumField as jest.Mock).mock.calls.at(-1)[0];
      const multipleFieldProps = (MultipleSelectField as jest.Mock).mock.calls.at(-1)[0];

      // Trigger the onChange callbacks with valid values
      act(() => {
        stringFieldProps.onChange("test value", true);
        enumFieldProps.onChange("option1", true);
        multipleFieldProps.onChange(["option1", "option2"], true);
      });

      // Wait for the button to be enabled
      await waitFor(() => {
        const submitButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
        expect(submitButton).not.toBeDisabled();
      });

      // AND the user submits the form
      const submitButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      await user.click(submitButton);

      // THEN the service should be called with the correct data
      expect(mockCreateSensitivePersonalData).toHaveBeenCalledWith(
        {
          field1: "test value",
          field2: "option1",
          field3: ["option1", "option2"],
        },
        givenUserId,
        SAMPLE_FIELDS
      );

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
      // GIVEN the user preferences state service is mocked to return user preferences with PII required
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
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

      // AND the user should be navigated to the landing page
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(routerPaths.LANDING, { replace: true });
      });

      // AND a success message should be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Successfully logged out.", { variant: "success" });
      // AND no console errors or warnings should be logged
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe("Skip providing sensitive data", () => {
    beforeEach(() => {
      // GIVEN the user preferences state service is mocked to return user preferences with PII not required
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      });
    });

    it("should mark sensitive data as skipped when the user skips providing it", async () => {
      // GIVEN skip is successful
      const user = userEvent.setup();
      const skipSpy = jest.spyOn(sensitivePersonalDataService, "skip").mockResolvedValue(undefined);

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
      expect(UserPreferencesStateService.getInstance().setUserPreferences).toHaveBeenCalledWith({
        user_id: "given user id",
        language: Language.en,
        accepted_tc: expect.any(Date),
        experiments: {},
        has_sensitive_personal_data: true,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
      });

      // AND the user should be navigated to the root path
      expect(mockNavigate).toHaveBeenCalledWith(routerPaths.ROOT);

      // AND a success message should be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Personal data collection skipped.", {
        variant: "success",
      });
    });

    test("should stay on the same page when the user cancels the skip action", async () => {
      const user = userEvent.setup();
      // GIVEN sensitive personal data is not required
      const givenUserPreferences = {
        user_id: givenUserId,
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      };
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(givenUserPreferences);
      // AND skipping sensitive personal data method
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
      // AND the sensitive personal data is not required
      const givenUserPreferences = {
        user_id: givenUserId,
        language: Language.en,
        accepted_tc: new Date(),
        has_sensitive_personal_data: false,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        sessions: [],
        user_feedback_answered_questions: {},
        experiments: {},
      };
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(givenUserPreferences);

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

  describe("Field validation", () => {
    it("should show validation error for required string field when empty", async () => {
      // GIVEN a form with a required string field
      componentRender();

      // WHEN the field reports as invalid
      const stringFieldProps = (StringField as jest.Mock).mock.calls.at(-1)[0];
      act(() => {
        stringFieldProps.onChange("", false);
      });

      // THEN the submit button should be disabled
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeDisabled();
      });
    });

    it("should show validation error for string field with invalid pattern", async () => {
      // GIVEN a form with a string field that has a pattern validation
      const fieldWithPattern = {
        ...SAMPLE_STRING_FIELD,
        validation: {
          pattern: "^[A-Za-z]+$",
          errorMessage: "Only letters are allowed",
        },
      };
      useFieldsConfigSpy.mockReturnValue({
        fields: [fieldWithPattern],
        loading: false,
        error: null,
      });

      componentRender();

      // WHEN the field reports as invalid
      const stringFieldProps = (StringField as jest.Mock).mock.calls.at(-1)[0];
      act(() => {
        stringFieldProps.onChange("123", false);
      });

      // THEN the submit button should be disabled
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeDisabled();
      });
    });

    it("should show validation error for required enum field when empty", async () => {
      // GIVEN a form with a required enum field
      componentRender();

      // WHEN the field reports as invalid
      const enumFieldProps = (EnumField as jest.Mock).mock.calls.at(-1)[0];
      act(() => {
        enumFieldProps.onChange("", false);
      });

      // THEN the submit button should be disabled
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeDisabled();
      });
    });

    it("should show validation error for required multiple select field when empty", async () => {
      // GIVEN a form with a required multiple select field
      componentRender();

      // WHEN the field reports as invalid
      const multipleFieldProps = (MultipleSelectField as jest.Mock).mock.calls.at(-1)[0];
      act(() => {
        multipleFieldProps.onChange([], false);
      });

      // THEN the submit button should be disabled
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).toBeDisabled();
      });
    });

    it("should allow empty values for non-required fields", async () => {
      // GIVEN a form with non-required fields
      const nonRequiredFields = [
        { ...SAMPLE_STRING_FIELD, required: false },
        { ...SAMPLE_ENUM_FIELD, required: false },
        { ...SAMPLE_MULTIPLE_FIELD, required: false },
      ];
      useFieldsConfigSpy.mockReturnValue({
        fields: nonRequiredFields,
        loading: false,
        error: null,
      });

      componentRender();

      // WHEN all fields report as valid even when empty
      const stringFieldProps = (StringField as jest.Mock).mock.calls.at(-1)[0];
      const enumFieldProps = (EnumField as jest.Mock).mock.calls.at(-1)[0];
      const multipleFieldProps = (MultipleSelectField as jest.Mock).mock.calls.at(-1)[0];

      act(() => {
        stringFieldProps.onChange("", true);
        enumFieldProps.onChange("", true);
        multipleFieldProps.onChange([], true);
      });

      // THEN the submit button should be enabled
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON)).not.toBeDisabled();
      });
    });
  });
});
