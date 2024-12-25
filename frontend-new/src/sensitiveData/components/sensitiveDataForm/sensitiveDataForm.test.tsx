// mute chatty console
import "src/_test_utilities/consoleMock";

import { HashRouter, useNavigate } from "react-router-dom";

import userEvent, { UserEvent } from "@testing-library/user-event";
import { render, screen, waitFor } from "src/_test_utilities/test-utils";
import { typeDebouncedInput } from "src/_test_utilities/userEventFakeTimer";
import { getRandomString, getTestString, WHITESPACE } from "src/_test_utilities/specialCharacters";

import SensitiveDataForm, { DATA_TEST_ID, ERROR_MESSAGE } from "./SensitiveDataForm";
import { DATA_TEST_ID as BACKDROP_DATA_TEST_IDS } from "src/theme/Backdrop/Backdrop";
import { DATA_TEST_ID as CONFIRM_MODAL_DATA_TEST_IDS } from "src/theme/confirmModalDialog/ConfirmModalDialog";

import { routerPaths } from "src/app/routerPaths";
import * as restAPIErrorModule from "src/error/restAPIError/RestAPIError";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import {
  Language,
  SensitivePersonalDataRequirement,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { Gender, SensitivePersonalData } from "src/sensitiveData/types";
import { sensitivePersonalDataService } from "src/sensitiveData/services/sensitivePersonalDataService/sensitivePersonalData.service";
import { EncryptedDataTooLarge } from "src/sensitiveData/services/sensitivePersonalDataService/errors";
import * as writeRestAPIErrorToLogModule from "src/error/restAPIError/logger";
import * as NotistackModule from "notistack";
import { formConfig } from "./formConfig";

const givenUserId = getTestString(10);

const MINIMUM_SENSITIVE_PERSONAL_DATA: SensitivePersonalData = {
  first_name: getTestString(1),
  last_name: getTestString(1),
  contact_email: getTestString(1),
  phone_number: getTestString(1),
  address: getTestString(1),
  gender: Gender.MALE,
};

const MAXIMUM_SENSITIVE_PERSONAL_DATA: SensitivePersonalData = {
  first_name: getTestString(formConfig.first_name.maxLength!),
  last_name: getTestString(formConfig.last_name.maxLength!),
  contact_email: getTestString(formConfig.contact_email.maxLength!),
  phone_number: getTestString(formConfig.phone_number.maxLength!),
  address: getTestString(formConfig.address.maxLength!),
  gender: Gender.PREFER_NOT_TO_SAY,
};

const LARGE_SENSITIVE_PERSONAL_DATA: SensitivePersonalData = {
  first_name: getTestString(formConfig.first_name.maxLength! + 1),
  last_name: getTestString(formConfig.last_name.maxLength! + 1),
  contact_email: getTestString(formConfig.contact_email.maxLength! + 1),
  phone_number: getTestString(formConfig.phone_number.maxLength! + 1),
  address: getTestString(formConfig.address.maxLength! + 1),
  gender: Gender.PREFER_NOT_TO_SAY,
};

const MINIMUM_SENSITIVE_PERSONAL_DATA_WITH_WHITE_SPACES: SensitivePersonalData = {
  first_name: WHITESPACE + getTestString(1) + WHITESPACE,
  last_name: WHITESPACE + getTestString(1) + WHITESPACE,
  contact_email: WHITESPACE + getTestString(1) + WHITESPACE,
  phone_number: WHITESPACE + getTestString(1) + WHITESPACE,
  address: WHITESPACE + getTestString(1) + WHITESPACE,
  gender: Gender.OTHER,
};

const MAXIMUM_SENSITIVE_PERSONAL_DATA_WITH_WHITE_SPACES: SensitivePersonalData = {
  first_name: WHITESPACE + getTestString(formConfig.first_name.maxLength!) + WHITESPACE,
  last_name: WHITESPACE + getTestString(formConfig.last_name.maxLength!) + WHITESPACE,
  contact_email: WHITESPACE + getTestString(formConfig.contact_email.maxLength!) + WHITESPACE,
  phone_number: WHITESPACE + getTestString(formConfig.phone_number.maxLength!) + WHITESPACE,
  address: WHITESPACE + getTestString(formConfig.address.maxLength!) + WHITESPACE,
  gender: Gender.PREFER_NOT_TO_SAY,
};

const MEDIUM_LENGTH_SENSITIVE_PERSONAL_DATA = {
  first_name: getRandomString(Math.floor(formConfig.first_name.maxLength! / 2)),
  last_name: getRandomString(Math.floor(formConfig.last_name.maxLength! / 2)),
  contact_email: getRandomString(Math.floor(formConfig.contact_email.maxLength! / 2)),
  phone_number: getRandomString(Math.floor(formConfig.phone_number.maxLength! / 2)),
  address: getRandomString(Math.floor(formConfig.address.maxLength! / 2)),
  gender: Gender.FEMALE,
};

const SAMPLE_USER_PREFERENCES = {
  user_id: givenUserId,
  language: Language.en,
  accepted_tc: new Date(),
  sessions: [],
  sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
  has_sensitive_personal_data: false,
};

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
    useNavigate: jest.fn().mockReturnValue(jest.fn()),
    NavLink: jest.fn().mockImplementation(() => {
      return <></>;
    }),
  };
});

const useSnackBarSpy = jest.spyOn(NotistackModule, "useSnackbar");

const componentRender = () => {
  return render(
    <HashRouter>
      <SensitiveDataForm />
    </HashRouter>
  );
};

async function fillInput(inputTestId: string, value: string) {
  const input = screen.getByTestId(inputTestId)!;
  await typeDebouncedInput(input, value);
}

async function fillTheForm(user: UserEvent, data: SensitivePersonalData) {
  await fillInput(DATA_TEST_ID.SENSITIVE_DATA_FORM_FIRST_NAME_INPUT, data.first_name);
  await fillInput(DATA_TEST_ID.SENSITIVE_DATA_FORM_LAST_NAME_INPUT, data.last_name);
  await fillInput(DATA_TEST_ID.SENSITIVE_DATA_FORM_CONTACT_EMAIL_INPUT, data.contact_email);
  await fillInput(DATA_TEST_ID.SENSITIVE_DATA_FORM_PHONE_NUMBER_INPUT, data.phone_number);
  await fillInput(DATA_TEST_ID.SENSITIVE_DATA_FORM_ADDRESS_INPUT, data.address);

  const genderSelect = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_GENDER_INPUT) as HTMLSelectElement;
  await user.selectOptions(genderSelect, data.gender);
}

describe("Sensitive Data", () => {
  let mockLogout: jest.Mock = jest.fn();
  let mockNavigate: jest.Mock = jest.fn();
  const enqueueSnackbarMock = jest.fn();

  beforeEach(() => {
    // Mock the enqueue snackbar hook
    useSnackBarSpy.mockReturnValue({
      enqueueSnackbar: enqueueSnackbarMock,
      closeSnackbar: jest.fn(),
    });

    // @ts-ignore
    jest.spyOn(AuthenticationServiceFactory, "getCurrentAuthenticationService").mockReturnValue({
      logout: mockLogout,
    });

    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);

    jest
      .spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences")
      .mockReturnValue(SAMPLE_USER_PREFERENCES);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // remove all mocks, to prevent side effects in other tests.
    jest.restoreAllMocks();
  });

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

      // AND no console errors should be logged
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe("input validation tests", () => {
    const defaultInvalidValues = [
      { test: "empty_string", value: "" },
      { test: "only_spaces", value: WHITESPACE },
      { test: "multiple_empty_spaces", value: WHITESPACE.repeat(10) },
    ];

    describe.each([
      ["first_name", defaultInvalidValues],
      ["last_name", defaultInvalidValues],
      ["contact_email", defaultInvalidValues],
      ["phone_number", defaultInvalidValues],
      ["address", defaultInvalidValues],
    ])("should disable the submit button if the user enters invalid data on field %s", (field_name, invalid_values) => {
      test.each(invalid_values)(`should disable when ${field_name} is $test`, async ({ value }) => {
        // This test if we give an invalid value to the field, the submit button should be disabled.
        // It starts by filling the form with an invalid value for the field_name field.
        // AND then it checks if the submit button is disabled.
        // After that it then fills the form with a valid value for the field_name field
        // and checks if the submit button is enabled.

        const user = userEvent.setup();

        // GIVEN a valid sensitive personal data.
        // Do a deep copy of the object to avoid modifying the original object.
        const givenSensitivePersonalData: SensitivePersonalData = { ...MINIMUM_SENSITIVE_PERSONAL_DATA };

        // AND the {field_name} field is filled with the {invalid_value} value.
        // @ts-ignore
        givenSensitivePersonalData[field_name] = value;

        // WHEN the user enters all fields except the {field_name} field, which has the value {invalid_value_case}
        componentRender();

        // AND the form inputs are filled
        await fillTheForm(user, givenSensitivePersonalData);

        // THEN the submit button should be disabled.
        const button = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
        expect(button).toBeDisabled();

        // AND no console errors should be logged
        expect(console.error).not.toHaveBeenCalled();
      });
    });

    it.each([
      { test: "1 character", testData: MINIMUM_SENSITIVE_PERSONAL_DATA },
      { test: "maximum characters", testData: MAXIMUM_SENSITIVE_PERSONAL_DATA },
      {
        test: "maximum characters with leading and trailing whitespaces",
        testData: MAXIMUM_SENSITIVE_PERSONAL_DATA_WITH_WHITE_SPACES,
      },
      { test: "medium length", testData: MEDIUM_LENGTH_SENSITIVE_PERSONAL_DATA },
      {
        test: "1 character with leading and trailing spaces",
        testData: MINIMUM_SENSITIVE_PERSONAL_DATA_WITH_WHITE_SPACES,
      },
      {
        test: "sensitive personal data with length larger than the maximum",
        testData: LARGE_SENSITIVE_PERSONAL_DATA,
      },
    ])("should enable the submit button if all the fields has $test", async ({ testData }) => {
      const createSensitivePersonalData = jest.spyOn(sensitivePersonalDataService, "createSensitivePersonalData");

      const user = userEvent.setup();

      // GIVEN a valid sensitive personal data.
      const givenSensitivePersonalData: SensitivePersonalData = testData;

      // AND the component is rendered.
      componentRender();

      // WHEN the user enters now all fields with valid values
      await fillTheForm(user, givenSensitivePersonalData);

      // THEN the submit button should be enabled.
      const button = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      expect(button).toBeEnabled();

      // AND no console errors should be logged
      expect(console.error).not.toHaveBeenCalled();

      // AND WHEN the user clicks the submit button, the form should be submitted.
      await user.click(button);

      // THEN createSensitivePersonalData should be called with the correct arguments.
      expect(createSensitivePersonalData).toHaveBeenCalledWith(
        {
          first_name: givenSensitivePersonalData.first_name.trim().substring(0, formConfig.first_name.maxLength),
          last_name: givenSensitivePersonalData.last_name.trim().substring(0, formConfig.last_name.maxLength),
          contact_email: givenSensitivePersonalData.contact_email
            .trim()
            .substring(0, formConfig.contact_email.maxLength),
          phone_number: givenSensitivePersonalData.phone_number.trim().substring(0, formConfig.phone_number.maxLength),
          address: givenSensitivePersonalData.address.trim().substring(0, formConfig.address.maxLength),
          gender: givenSensitivePersonalData.gender,
        },
        givenUserId
      );
    });
  });

  describe("action tests: reject providing sensitive user data", () => {
    it("should successfully log the user out if the user chooses not to provide sensitive personal data", async () => {
      const user = userEvent.setup();

      // GIVEN logout is successful and will resolve
      let resolveLogout: (value: unknown) => void = () => {};
      mockLogout.mockReturnValue(
        new Promise((resolve, _reject) => {
          resolveLogout = resolve;
        })
      );

      // AND the component is rendered
      componentRender();

      // WHEN the reject button is clicked
      const rejectButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON);
      await user.click(rejectButton);

      // AND the user approves the action
      await user.click(screen.getByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL_CONFIRM));

      // THEN the button should be disabled
      await waitFor(() => expect(rejectButton).toHaveAttribute("aria-disabled", "true"));

      // THEN the loading backdrop should be displayed
      expect(screen.getByTestId(BACKDROP_DATA_TEST_IDS.BACKDROP_CONTAINER)).toBeVisible();

      // AND logout function should be called
      expect(mockLogout).toHaveBeenCalledTimes(1);

      // AND when the promise resolves
      resolveLogout(undefined);

      // AND user should be navigated to log in
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(routerPaths.LOGIN, { replace: true });
      });

      // AND success snackbar should be displayed
      expect(enqueueSnackbarMock).toHaveBeenCalledWith("Successfully logged out.", { variant: "success" });

      // AND the reject button should be enabled
      expect(rejectButton).toHaveAttribute("aria-disabled", "false");

      // AND the progress dialog should be closed
      expect(screen.queryByTestId(BACKDROP_DATA_TEST_IDS.BACKDROP_CONTAINER)).not.toBeVisible();
    });

    it("should not log the user out if the user cancels on the approve dialog", async () => {
      const user = userEvent.setup();

      // GIVEN the component is rendered
      componentRender();

      // WHEN the reject button is clicked
      const rejectButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON);
      await user.click(rejectButton);

      // Guard: the approval dialog is shown
      expect(screen.getByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL)).toBeVisible();

      // AND the clicks on the cancel button on the confirm dialog.
      await user.click(screen.getByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL_CANCEL));

      // THEN the approval modal should be closed
      await waitFor(() =>
        expect(screen.queryByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL)).not.toBeInTheDocument()
      );

      // AND the reject button should be enabled
      expect(rejectButton).toHaveAttribute("aria-disabled", "false");

      // THEN logout should not be called
      expect(mockLogout).not.toHaveBeenCalled();

      // AND user should not be navigated to log in
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("should handle AuthenticationService.logout error correctly", async () => {
      const user = userEvent.setup();

      // GIVEN logout throws an error
      const givenLogoutError = new Error("Logout failed");
      let rejectLogout: (reason?: any) => void = () => {};
      mockLogout.mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectLogout = reject;
        })
      );

      // AND the component is rendered
      componentRender();

      // WHEN the reject button is clicked
      const rejectButton = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON);
      await user.click(rejectButton);

      // AND the user approves the action
      await user.click(screen.getByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL_CONFIRM));

      // THEN the button should be disabled
      expect(rejectButton).toHaveAttribute("aria-disabled", "true");

      // AND the loading backdrop should be displayed
      await waitFor(() => expect(screen.getByTestId(BACKDROP_DATA_TEST_IDS.BACKDROP_CONTAINER)).toBeVisible());

      // AND the approval dialog should be closed
      await waitFor(() =>
        expect(screen.queryByTestId(CONFIRM_MODAL_DATA_TEST_IDS.CONFIRM_MODAL)).not.toBeInTheDocument()
      );

      // AND the logout function should be called.
      expect(mockLogout).toHaveBeenCalledTimes(1);

      // AND logout function rejects
      rejectLogout(givenLogoutError);

      // AND user should not be navigated to log in
      expect(mockNavigate).not.toHaveBeenCalled();

      // AND error should be logged
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith("Failed to log out", givenLogoutError);
      });

      // AND error snackbar should be displayed
      expect(enqueueSnackbarMock).toHaveBeenCalledWith("Failed to log out.", { variant: "error" });

      // AND the reject button should be enabled again
      await waitFor(() => expect(rejectButton).toHaveAttribute("aria-disabled", "false"));

      // AND the progress dialog should be closed
      expect(screen.queryByTestId(BACKDROP_DATA_TEST_IDS.BACKDROP_CONTAINER)).not.toBeVisible();
    });
  });

  describe("action tests: submit sensitive personal data", () => {
    let mockSetUserPreferences: jest.SpyInstance;
    let mockCreateSensitivePersonalData: jest.SpyInstance;
    let spyWriteRestAPIErrorToLog: jest.SpyInstance;

    beforeEach(() => {
      mockSetUserPreferences = jest.spyOn(UserPreferencesStateService.getInstance(), "setUserPreferences");
      mockCreateSensitivePersonalData = jest.spyOn(sensitivePersonalDataService, "createSensitivePersonalData");
      spyWriteRestAPIErrorToLog = jest.spyOn(writeRestAPIErrorToLogModule, "writeRestAPIErrorToLog");
    });

    it("should save sensitive personal data successfully and navigate to the root path", async () => {
      const user = userEvent.setup();

      // GIVEN mockCreateSensitivePersonalData is successful
      let resolveCreateSensitivePersonalData: (value: unknown) => void = () => {};
      mockCreateSensitivePersonalData.mockReturnValue(
        new Promise((resolve, _reject) => {
          resolveCreateSensitivePersonalData = resolve;
        })
      );

      // AND user provides some sensitive personal data
      const givenSensitivePersonalData = MINIMUM_SENSITIVE_PERSONAL_DATA;

      // AND the component is successfully rendered
      componentRender();

      // AND The form inputs are filled
      await fillTheForm(user, givenSensitivePersonalData);

      // WHEN the submit button is clicked
      const button = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      expect(button).toBeInTheDocument();
      expect(button).toBeEnabled();
      await user.click(button);

      // THEN the save sensitive personal data should be called with the correct arguments.
      expect(mockCreateSensitivePersonalData).toHaveBeenCalledWith(givenSensitivePersonalData, givenUserId);

      // AND the circle progress is displayed
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).toBeVisible();

      // AND the button is disabled
      expect(button).toBeDisabled();

      // AND WHEN the create sensitive personal data resolves
      resolveCreateSensitivePersonalData(undefined);

      // THEN userPreferences should be updated
      await waitFor(() => {
        expect(mockSetUserPreferences).toHaveBeenCalledWith({
          ...UserPreferencesStateService.getInstance().getUserPreferences(),
          has_sensitive_personal_data: true,
        });
      });

      // AND success snackbar should be displayed
      expect(enqueueSnackbarMock).toHaveBeenCalledWith("Personal data saved successfully and securely.", {
        variant: "success",
      });

      // AND the button is disabled
      expect(button).toBeDisabled();

      // AND user should be navigated to the root path
      expect(mockNavigate).toHaveBeenCalledWith(routerPaths.ROOT);
    });

    it("should handle service error and display error in snackbar", async () => {
      const user = userEvent.setup();

      // GIVEN create sensitive personal data will fail
      const restAPIError = new RestAPIError("foo", "bar", "foo", "bar", 201, "foo", "foo");
      let rejectCreateSensitivePersonalData: (reason?: any) => void = () => {};
      mockCreateSensitivePersonalData.mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectCreateSensitivePersonalData = reject;
        })
      );

      // AND the getUserFriendlyErrorMessage will return some the user-friendly message
      const givenUserFriendlyMessage = "bar";
      jest.spyOn(restAPIErrorModule, "getUserFriendlyErrorMessage").mockReturnValue(givenUserFriendlyMessage);

      // AND given some sensitive personal data
      const givenData = MINIMUM_SENSITIVE_PERSONAL_DATA;

      // AND the Component is rendered
      componentRender();

      // AND The form inputs are filled
      await fillTheForm(user, givenData);

      // WHEN the submit button is clicked
      const button = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      await user.click(button);

      // THEN the button is disabled
      expect(button).toBeDisabled();

      // AND the circle progress is displayed
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).toBeVisible();

      // AND after the create sensitive personal data promise is rejected
      rejectCreateSensitivePersonalData(restAPIError);

      // AND create sensitive personal data should be called with the correct arguments.
      expect(mockCreateSensitivePersonalData).toHaveBeenCalledWith(givenData, givenUserId);

      // AND userPreferences should not be updated
      expect(mockSetUserPreferences).not.toHaveBeenCalled();

      // AND error snackbar should be displayed with the user-friendly message of the service error
      await waitFor(() => {
        expect(enqueueSnackbarMock).toHaveBeenCalledWith(givenUserFriendlyMessage, {
          variant: "error",
        });
      });

      // AND user should not be navigated
      expect(mockNavigate).not.toHaveBeenCalled();

      // AND error should be logged
      expect(spyWriteRestAPIErrorToLog).toHaveBeenCalledWith(restAPIError, expect.anything());

      // AND the button should be enabled
      await waitFor(() => expect(button).toBeEnabled());

      // AND the circle progress should not be displayed
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).not.toBeInTheDocument();
    });

    it("should handle encrypted data too large error correctly", async () => {
      const user = userEvent.setup();

      // GIVEN create sensitive personal data will throw an EncryptedDataTooLarge error
      const givenEncryptedDataTooLargeError = new EncryptedDataTooLarge({
        aes_encrypted_data: "foo",
        aes_encryption_key: "bar",
        rsa_key_id: "baz",
      });
      let rejectCreateSensitivePersonalData: (reason?: any) => void = () => {};
      const mockCreateSensitivePersonalData = jest
        .spyOn(sensitivePersonalDataService, "createSensitivePersonalData")
        .mockReturnValue(
          new Promise((_resolve, reject) => {
            rejectCreateSensitivePersonalData = reject;
          })
        );

      // AND given some user sensitive personal data
      const givenData = MINIMUM_SENSITIVE_PERSONAL_DATA;

      // AND Component is rendered
      componentRender();

      // AND The form inputs are filled
      await fillTheForm(user, givenData);

      // WHEN The submit button is clicked
      const button = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      await user.click(button);

      // THEN the button is disabled
      expect(button).toBeDisabled();

      // AND the circle progress is displayed
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).toBeVisible();

      // AND after the create sensitive personal data promise is rejected
      rejectCreateSensitivePersonalData(givenEncryptedDataTooLargeError);

      // AND create sensitive personal data should be called with the correct arguments.
      expect(mockCreateSensitivePersonalData).toHaveBeenCalledWith(givenData, givenUserId);

      // AND userPreferences should not be updated
      expect(mockSetUserPreferences).not.toHaveBeenCalled();

      // AND error snackbar should be displayed with the user-friendly message of the service error
      await waitFor(() => {
        expect(enqueueSnackbarMock).toHaveBeenCalledWith(ERROR_MESSAGE.ENCRYPTED_DATA_TOO_LARGE, {
          variant: "error",
        });
      });

      // AND user should not be navigated
      expect(mockNavigate).not.toHaveBeenCalled();

      // AND error should be logged
      expect(console.error).toHaveBeenCalledWith("Failed to save personal data", givenEncryptedDataTooLargeError);

      // AND the button should be enabled
      expect(button).toBeEnabled();

      // AND the circle progress should not be displayed
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).not.toBeInTheDocument();
    });

    it("should handle unexpected/unknown errors correctly", async () => {
      const user = userEvent.setup();
      // GIVEN create sensitive personal data will throw an unknown error
      const givenAnyError = new Error("foo");

      let rejectCreateSensitivePersonalData: (reason?: any) => void = () => {};
      const mockCreateSensitivePersonalData = jest
        .spyOn(sensitivePersonalDataService, "createSensitivePersonalData")
        .mockReturnValue(
          new Promise((_resolve, reject) => {
            rejectCreateSensitivePersonalData = reject;
          })
        );

      // AND given some user sensitive personal data
      const givenData = MINIMUM_SENSITIVE_PERSONAL_DATA;

      // AND Component is rendered
      componentRender();

      // AND The form inputs are filled
      await fillTheForm(user, givenData);

      // WHEN The submit button is clicked
      const button = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      await user.click(button);

      // THEN the button is disabled
      expect(button).toBeDisabled();

      // AND the circle progress is displayed
      expect(screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).toBeVisible();

      // AND after the create sensitive personal data promise is rejected
      rejectCreateSensitivePersonalData(givenAnyError);

      // AND create sensitive personal data should be called with the correct arguments.
      expect(mockCreateSensitivePersonalData).toHaveBeenCalledWith(givenData, givenUserId);

      // AND userPreferences should not be updated
      expect(mockSetUserPreferences).not.toHaveBeenCalled();

      // AND error snackbar should be displayed with the user-friendly message of the service error
      await waitFor(() => {
        expect(enqueueSnackbarMock).toHaveBeenCalledWith(ERROR_MESSAGE.DEFAULT, {
          variant: "error",
        });
      });

      // AND user should not be navigated
      expect(mockNavigate).not.toHaveBeenCalled();

      // AND error should be logged
      expect(console.error).toHaveBeenCalledWith("Failed to save personal data", givenAnyError);

      // AND the button should be enabled
      expect(button).toBeEnabled();

      // AND the circle progress should not be displayed
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).not.toBeInTheDocument();
    });

    it("should not proceed if userPreferences is undefined", async () => {
      const user = userEvent.setup();

      // GIVEN userPreferences are undefined
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(null);

      // AND given some user sensitive personal data
      const givenData = MINIMUM_SENSITIVE_PERSONAL_DATA;

      // AND Component is rendered
      componentRender();

      // AND The form inputs are filled
      await fillTheForm(user, givenData);

      // WHEN The submit button is clicked
      const button = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      await user.click(button);

      // AND create sensitive personal data should not be called
      expect(mockCreateSensitivePersonalData).not.toHaveBeenCalled();

      // AND userPreferences should not be updated
      expect(mockSetUserPreferences).not.toHaveBeenCalled();

      // AND error snackbar should be displayed with the user-friendly message of the service error
      await waitFor(() => {
        expect(enqueueSnackbarMock).toHaveBeenCalledWith(ERROR_MESSAGE.DEFAULT, {
          variant: "error",
        });
      });

      // AND user should not be navigated
      expect(mockNavigate).not.toHaveBeenCalled();

      // AND error: userPreferences is undefined should be logged
      expect(console.error).toHaveBeenCalledWith(new Error("User preferences not found"));

      // AND the button should be enabled
      expect(button).toBeEnabled();

      // AND the circle progress should not be displayed
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).not.toBeInTheDocument();
    });

    it("should handle correctly if the user tries to submit the form if the form is not valid", async () => {
      const user = userEvent.setup();

      // GIVEN userPreferences are undefined
      jest.spyOn(UserPreferencesStateService.getInstance(), "getUserPreferences").mockReturnValue(null);

      // AND Component is rendered
      componentRender();

      // AND the user don't fill the form
      // WHEN The submit button is manually updated to remove disabled=true.
      const button = screen.getByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON);
      button.removeAttribute("disabled");
      button.classList.remove("Mui-disabled");

      // AND the button is clicked
      await user.click(button);

      // AND create sensitive personal data should not be called
      expect(mockCreateSensitivePersonalData).not.toHaveBeenCalled();

      // AND userPreferences should not be updated
      expect(mockSetUserPreferences).not.toHaveBeenCalled();

      // AND user should not be navigated
      expect(mockNavigate).not.toHaveBeenCalled();

      // AND the button should be enabled
      expect(button).toBeEnabled();

      // AND the circle progress should not be displayed
      expect(screen.queryByTestId(DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS)).not.toBeInTheDocument();
    });
  });
});
