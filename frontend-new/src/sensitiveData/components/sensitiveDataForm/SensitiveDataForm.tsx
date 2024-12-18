import React, { useCallback, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  useTheme,
} from "@mui/material";

import debounce from "lodash.debounce";

import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import { StyledAnchor } from "src/theme/StyledAnchor/StyledAnchor";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import { Gender, SensitivePersonalData } from "src/sensitiveData/types";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import BugReportButton from "src/feedback/bugReportButton/BugReportButton";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";
import { EncryptedDataTooLarge } from "src/sensitiveData/services/sensitivePersonalDataService/errors";
import { sensitivePersonalDataService } from "src/sensitiveData/services/sensitivePersonalDataService/sensitivePersonalData.service";
import TextConfirmModalDialog from "src/theme/textConfirmModalDialog/TextConfirmModalDialog";
import { DEBOUNCE_TIME, formConfig } from "./formConfig";

const uniqueId = "ab02918f-d559-47ba-9662-ea6b3a3606d1";

export const DATA_TEST_ID = {
  // containers

  SENSITIVE_DATA_CONTAINER: `sensitive-data-container-${uniqueId}`,

  // inputs.
  SENSITIVE_DATA_FORM_FIRST_NAME_INPUT: `sensitive-data-form-first-name-input-${uniqueId}`,
  SENSITIVE_DATA_FORM_LAST_NAME_INPUT: `sensitive-data-form-last-name-input-${uniqueId}`,
  SENSITIVE_DATA_FORM_CONTACT_EMAIL_INPUT: `sensitive-data-form-contact-email-input-${uniqueId}`,
  SENSITIVE_DATA_FORM_PHONE_NUMBER_INPUT: `sensitive-data-form-phone-number-input-${uniqueId}`,
  SENSITIVE_DATA_FORM_ADDRESS_INPUT: `sensitive-data-form-address-input-${uniqueId}`,
  SENSITIVE_DATA_FORM_GENDER_INPUT: `sensitive-data-form-gender-input-${uniqueId}`,

  // action buttons

  SENSITIVE_DATA_FORM_BUTTON: `sensitive-data-form-button-${uniqueId}`,
  SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS: `sensitive-data-form-button-circular-progress-${uniqueId}`,
  SENSITIVE_DATA_REJECT_BUTTON: `sensitive-data-reject-button-${uniqueId}`,
};

export const ERROR_MESSAGE = {
  ENCRYPTED_DATA_TOO_LARGE:
    "The personal data seems to be too large to be saved." +
    "Please try again by entering smaller values for the fields." +
    "If the problem persists, clear your browser's cache and refresh the page.",
  DEFAULT:
    "The personal data could not be saved." +
    "Please try again and if the problem persists, clear your browser's cache and refresh the page.",
};

const isStringValid = (value: string, max: number) => {
  return !!value && value.trim().length > 0 && value.trim().length <= max;
};

const validateSensitiveData = (data: SensitivePersonalData): Record<keyof SensitivePersonalData, boolean> => {
  return {
    first_name: isStringValid(data.first_name, formConfig.first_name.maxLength!),
    last_name: isStringValid(data.last_name, formConfig.last_name.maxLength!),
    gender: true,
    address: isStringValid(data.address, formConfig.address.maxLength!),
    contact_email: isStringValid(data.contact_email, formConfig.contact_email.maxLength!),
    phone_number: isStringValid(data.phone_number, formConfig.phone_number.maxLength!),
  };
};

function isFormValid(result: ReturnType<typeof validateSensitiveData>): boolean {
  for (let value of Object.values(result)) {
    if (!value) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitize the sensitive personal data before sending it to the server.
 *
 * @param data - The sensitive personal data to sanitize.
 */
const sanitize = (data: SensitivePersonalData): SensitivePersonalData => ({
  gender: data.gender,
  first_name: data.first_name.trim(),
  last_name: data.last_name.trim(),
  contact_email: data.contact_email.trim(),
  phone_number: data.phone_number.trim(),
  address: data.address.trim(),
});

const SensitiveDataForm: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [isSavingSensitiveData, setIsSavingSensitiveData] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [isSubmitButtonEnabled, setIsSubmitButtonEnabled] = useState(false);

  const sensitiveData = useRef<SensitivePersonalData>({
    first_name: "",
    last_name: "",
    contact_email: "",
    phone_number: "",
    address: "",
    gender: Gender.PREFER_NOT_TO_SAY,
  });

  const handleFieldChange = <Key extends keyof SensitivePersonalData>(key: Key, target: any) => {
    target.value = target.value.trimStart() as SensitivePersonalData[Key];

    if (formConfig[key]?.maxLength)
      target.value = target.value.substring(0, formConfig[key].maxLength) as SensitivePersonalData[Key];

    sensitiveData.current[key] = target.value;
    setIsSubmitButtonEnabled(isFormValid(validateSensitiveData(sensitiveData.current)));
  };

  const debouncedHandleFieldChange = debounce(handleFieldChange, DEBOUNCE_TIME);

  const handleSaveSensitivePersonalData = useCallback(async () => {
    setIsSavingSensitiveData(true);
    setIsSubmitButtonEnabled(false);

    const userPreferences = userPreferencesStateService.getUserPreferences();

    if (!userPreferences) {
      // something is not right, we should have user preferences at this point.
      console.error(new Error("User preferences not found"));
      enqueueSnackbar(ERROR_MESSAGE.DEFAULT, { variant: "error" });
      setIsSavingSensitiveData(false);
      setIsSubmitButtonEnabled(true);
      return;
    }

    try {
      await sensitivePersonalDataService.createSensitivePersonalData(
        sanitize(sensitiveData.current),
        userPreferences.user_id
      );

      // Update user preferences to indicate that the user has sensitive personal data
      // so that the user is not prompted to provide this information again.
      // We set the state directly because we don't want to go to the server to get the updated the user preferences.
      userPreferencesStateService.setUserPreferences({
        ...userPreferences,
        has_sensitive_personal_data: true,
      });

      enqueueSnackbar("Personal data saved successfully and securely.", { variant: "success" });
      navigate(routerPaths.ROOT);
    } catch (e) {
      if (e instanceof ServiceError) {
        writeServiceErrorToLog(e, console.error);
        enqueueSnackbar(getUserFriendlyErrorMessage(e), { variant: "error" });
      } else if (e instanceof EncryptedDataTooLarge) {
        console.error("Failed to save personal data", e);
        enqueueSnackbar(ERROR_MESSAGE.ENCRYPTED_DATA_TOO_LARGE, { variant: "error" });
      } else {
        console.error("Failed to save personal data", e);
        enqueueSnackbar(ERROR_MESSAGE.DEFAULT, { variant: "error" });
      }
      setIsSavingSensitiveData(false);
      setIsSubmitButtonEnabled(true);
    }
  }, [enqueueSnackbar, navigate]);

  const handleRejectProvidingSensitiveData = useCallback(async () => {
    setIsRejecting(true);
    setConfirmingReject(false);
    setIsSubmitButtonEnabled(false);
    try {
      const authenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
      await authenticationService!.logout();
      navigate(routerPaths.LOGIN, { replace: true });
      enqueueSnackbar("Successfully logged out.", { variant: "success" });
    } catch (e) {
      console.error("Failed to log out", e);
      enqueueSnackbar("Failed to log out.", { variant: "error" });
    } finally {
      setIsSubmitButtonEnabled(true);
      setIsRejecting(false);
    }
  }, [enqueueSnackbar, navigate]);

  return (
    <>
      <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.SENSITIVE_DATA_CONTAINER}>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          gap={theme.fixedSpacing(theme.tabiyaSpacing.lg)}
          width={"100%"}
        >
          <AuthHeader
            title={"Provide Your Information"}
            subtitle={
              "Please make sure the information you provide is accurate and has no mistakes. Your information cannot be changed after submission."
            }
          />

          <Box width={"100%"} display={"flex"} flexDirection={"column"} gap={theme.tabiyaSpacing.xl}>
            <Box display="flex" flexDirection="column" gap={theme.tabiyaSpacing.lg}>
              <TextField
                fullWidth
                type={"text"}
                label="First name"
                variant="outlined"
                inputProps={{
                  "data-testid": DATA_TEST_ID.SENSITIVE_DATA_FORM_FIRST_NAME_INPUT,
                }}
                required={true}
                onChange={(e) => {
                  debouncedHandleFieldChange("first_name", e.target);
                }}
              />

              <TextField
                fullWidth
                type={"text"}
                label="Last name"
                variant="outlined"
                inputProps={{
                  "data-testid": DATA_TEST_ID.SENSITIVE_DATA_FORM_LAST_NAME_INPUT,
                }}
                required={true}
                onChange={(e) => debouncedHandleFieldChange("last_name", e.target)}
              />

              <TextField
                fullWidth
                label="Contact email"
                type={"email"}
                variant="outlined"
                inputProps={{
                  "data-testid": DATA_TEST_ID.SENSITIVE_DATA_FORM_CONTACT_EMAIL_INPUT,
                }}
                required={true}
                onChange={(e) => debouncedHandleFieldChange("contact_email", e.target)}
              />

              <TextField
                fullWidth
                type={"text"}
                label="Phone number"
                variant="outlined"
                inputProps={{
                  "data-testid": DATA_TEST_ID.SENSITIVE_DATA_FORM_PHONE_NUMBER_INPUT,
                }}
                required={true}
                onChange={(e) => debouncedHandleFieldChange("phone_number", e.target)}
              />

              <TextField
                fullWidth
                type={"text"}
                label="Address"
                variant="outlined"
                inputProps={{
                  "data-testid": DATA_TEST_ID.SENSITIVE_DATA_FORM_ADDRESS_INPUT,
                }}
                required={true}
                onChange={(e) => debouncedHandleFieldChange("address", e.target)}
              />

              <FormControl fullWidth>
                <InputLabel id="select-label">Gender</InputLabel>
                <Select
                  defaultValue={Gender.PREFER_NOT_TO_SAY}
                  labelId="gender-select-label"
                  id="gender-select"
                  label="Gender"
                  data-testid={DATA_TEST_ID.SENSITIVE_DATA_FORM_GENDER_INPUT}
                  inputProps={{
                    "aria-label": "gender-select",
                  }}
                  onChange={(event) => {
                    handleFieldChange("gender", event.target);
                  }}
                  variant={"outlined"}
                >
                  <MenuItem
                    data-testid={`${DATA_TEST_ID.SENSITIVE_DATA_FORM_GENDER_INPUT}-${Gender.MALE}`}
                    value={Gender.MALE}
                  >
                    Male
                  </MenuItem>
                  <MenuItem
                    data-testid={`${DATA_TEST_ID.SENSITIVE_DATA_FORM_GENDER_INPUT}-${Gender.FEMALE}`}
                    value={Gender.FEMALE}
                  >
                    Female
                  </MenuItem>
                  <MenuItem
                    data-testid={`${DATA_TEST_ID.SENSITIVE_DATA_FORM_GENDER_INPUT}-${Gender.OTHER}`}
                    value={Gender.OTHER}
                  >
                    Other
                  </MenuItem>
                  <MenuItem
                    data-testid={`${DATA_TEST_ID.SENSITIVE_DATA_FORM_GENDER_INPUT}-${Gender.PREFER_NOT_TO_SAY}`}
                    value={Gender.PREFER_NOT_TO_SAY}
                  >
                    Prefer not to say
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box
              sx={{
                width: "100%",
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: theme.tabiyaSpacing.xl,
              }}
            >
              <StyledAnchor
                data-testid={DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON}
                disabled={isRejecting}
                onClick={() => {
                  setConfirmingReject(true);
                }}
              >
                No, thank you
              </StyledAnchor>

              <PrimaryButton
                fullWidth
                variant="contained"
                color="primary"
                disabled={!isSubmitButtonEnabled}
                disableWhenOffline={true}
                onClick={handleSaveSensitivePersonalData}
                data-testid={DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON}
              >
                {isSavingSensitiveData ? (
                  <CircularProgress
                    color={"secondary"}
                    size={theme.typography.h5.fontSize}
                    sx={{ marginTop: theme.tabiyaSpacing.xs, marginBottom: theme.tabiyaSpacing.xs }}
                    aria-label={"Registering"}
                    data-testid={DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS}
                  />
                ) : (
                  "Start conversation"
                )}
              </PrimaryButton>
            </Box>
          </Box>
        </Box>
      </Container>
      <BugReportButton bottomAlign={true} />
      <TextConfirmModalDialog
        isOpen={confirmingReject}
        title="Are you sure?"
        textParagraphs={[
          {
            id: "1",
            text: "We're sorry that you chose not to provide your data. You will not be able to proceed and will be logged out.",
          },
          {
            id: "2",
            text: "Are you sure you want to exit?",
          },
        ]}
        onCancel={() => {
          setConfirmingReject(false);
        }}
        onConfirm={handleRejectProvidingSensitiveData}
        cancelButtonText="Cancel"
        confirmButtonText={"Yes, I'm sure"}
      />
      <Backdrop isShown={isRejecting} message={"Logging you out..."} />
    </>
  );
};

export default SensitiveDataForm;
