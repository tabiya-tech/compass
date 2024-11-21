import React, { useCallback, useState } from "react";
import {
  Box,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  styled,
  TextField,
  useTheme,
} from "@mui/material";

import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { useForm } from "src/utils/useForm/useForm";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import BugReportButton from "src/feedback/bugReportButton/BugReportButton";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";
import { Gender, SensitivePersonalData } from "src/sensitiveData/services/sensitivePersonalDataService/types";
import { sensitivePersonalDataService } from "src/sensitiveData/services/sensitivePersonalDataService/sensitivePersonalDataService";

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

const StyledAnchor = styled("a")(({ theme }) => ({
  color: theme.palette.tabiyaBlue.main,
  textDecoration: "underline",
  cursor: "pointer",
  fontWeight: "bold",
  whiteSpace: "nowrap",
  "&:hover": {
    color: theme.palette.tabiyaBlue.light,
  },
}));

const sensitiveDataForm = {
  fields: {
    contact_email: { required: true, defaultValue: "" },
    first_name: { required: true, defaultValue: "" },
    last_name: { required: true, defaultValue: "" },
    phone_number: { required: true, defaultValue: "" },
    address: { required: true, defaultValue: "" },
    gender: { required: true, defaultValue: Gender.PREFER_NOT_TO_SAY },
  },
};

const SensitiveData: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const {
    fieldFormProps,
    values: sensitivePersonalData,
    isFormValid,
    setValue,
  } = useForm<SensitivePersonalData>(sensitiveDataForm);

  const [isSavingSensitiveData, setIsSavingSensitiveData] = useState(false);

  const handleSaveSensitivePersonalData = useCallback(async () => {
    setIsSavingSensitiveData(true);

    try {
      const userPreferences = userPreferencesStateService.getUserPreferences();

      if (!userPreferences) {
        // something is not right, we should have user preferences at this point.
        throw new Error("User preferences not found.");
      }

      console.log({ userPreferences });
      await sensitivePersonalDataService.createSensitivePersonalData(sensitivePersonalData, userPreferences.user_id);

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
      } else {
        enqueueSnackbar(`Failed to save personal data: ${(e as Error).message}`, { variant: "error" });
        console.error("Failed to save personal data", e);
      }
    } finally {
      setIsSavingSensitiveData(false);
    }
  }, [enqueueSnackbar, navigate, sensitivePersonalData]);

  const handleRejectProvidingSensitiveData = useCallback(async () => {
    try {
      const authenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
      await authenticationService!.logout();
      navigate(routerPaths.LOGIN, { replace: true });
      enqueueSnackbar("Successfully logged out.", { variant: "success" });
    } catch (e) {
      console.error("Failed to log out", e);
      enqueueSnackbar("Failed to log out.", { variant: "error" });
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
              "Provide your personal details carefully. Your information is secure and cannot be changed after submission."
            }
          />

          <Box width={"100%"} display={"flex"} flexDirection={"column"} gap={theme.tabiyaSpacing.xl}>
            <Box display="flex" flexDirection="column" gap={theme.tabiyaSpacing.lg}>
              <TextField
                fullWidth
                label="First name"
                variant="outlined"
                inputProps={{
                  "data-testid": DATA_TEST_ID.SENSITIVE_DATA_FORM_FIRST_NAME_INPUT,
                }}
                {...fieldFormProps.first_name}
              />

              <TextField
                fullWidth
                label="Last name"
                variant="outlined"
                inputProps={{
                  "data-testid": DATA_TEST_ID.SENSITIVE_DATA_FORM_LAST_NAME_INPUT,
                }}
                {...fieldFormProps.last_name}
              />

              <TextField
                fullWidth
                label="Contact email"
                type={"email"}
                variant="outlined"
                inputProps={{
                  "data-testid": DATA_TEST_ID.SENSITIVE_DATA_FORM_CONTACT_EMAIL_INPUT,
                }}
                {...fieldFormProps.contact_email}
              />

              <TextField
                fullWidth
                label="Phone number"
                variant="outlined"
                inputProps={{
                  "data-testid": DATA_TEST_ID.SENSITIVE_DATA_FORM_PHONE_NUMBER_INPUT,
                }}
                {...fieldFormProps.phone_number}
              />

              <TextField
                fullWidth
                label="Address"
                variant="outlined"
                inputProps={{
                  "data-testid": DATA_TEST_ID.SENSITIVE_DATA_FORM_ADDRESS_INPUT,
                }}
                {...fieldFormProps.address}
              />

              <FormControl fullWidth>
                <InputLabel id="select-label">Gender</InputLabel>
                <Select
                  labelId="demo-simple-select-label"
                  id="demo-simple-select"
                  label="Gender"
                  data-testid={DATA_TEST_ID.SENSITIVE_DATA_FORM_GENDER_INPUT}
                  value={sensitivePersonalData.gender}
                  onChange={(event) => {
                    setValue("gender", event.target.value as Gender);
                  }}
                  variant={"outlined"}
                >
                  <MenuItem value={Gender.MALE}>Male</MenuItem>
                  <MenuItem value={Gender.FEMALE}>Female</MenuItem>
                  <MenuItem value={Gender.OTHER}>Other</MenuItem>
                  <MenuItem value={Gender.PREFER_NOT_TO_SAY}>Prefer not to say</MenuItem>
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
                onClick={handleRejectProvidingSensitiveData}
              >
                No, thank you
              </StyledAnchor>

              <PrimaryButton
                fullWidth
                variant="contained"
                color="primary"
                disabled={isSavingSensitiveData || !isFormValid}
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
    </>
  );
};

export default SensitiveData;
