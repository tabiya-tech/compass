import { useCallback, useState, useEffect, Suspense } from "react";
import { Box, CircularProgress, Container, useMediaQuery, useTheme, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import { SensitivePersonalData } from "src/sensitiveData/types";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { getUserFriendlyErrorMessage, RestAPIError } from "src/error/restAPIError/RestAPIError";
import { EncryptedDataTooLarge } from "src/sensitiveData/services/sensitivePersonalDataService/errors";
import {
  sensitivePersonalDataService,
} from "src/sensitiveData/services/sensitivePersonalDataService/sensitivePersonalData.service";
import TextConfirmModalDialog from "src/theme/textConfirmModalDialog/TextConfirmModalDialog";
import { FieldDefinition, FieldType } from "src/sensitiveData/components/sensitiveDataForm/config/types";
import { useFieldsConfig } from "src/sensitiveData/components/sensitiveDataForm/config/useFieldsConfig";
import CustomLink from "src/theme/CustomLink/CustomLink";
import {
  SensitivePersonalDataRequirement,
  UserPreference,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { UserPreferenceError } from "src/error/commonErrors";
import { HighlightedSpan } from "src/consent/components/consentPage/Consent";
import { Theme } from "@mui/material/styles";
import HelpTip from "src/theme/HelpTip/HelpTip";
import PrivacyTipIcon from "@mui/icons-material/PrivacyTip";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import StringField from "src/sensitiveData/components/sensitiveDataForm/components/StringField";
import EnumField from "src/sensitiveData/components/sensitiveDataForm/components/EnumField";
import MultipleSelectField from "src/sensitiveData/components/sensitiveDataForm/components/MultipleSelectField";
import { createEmptySensitivePersonalData, extractPersonalInfo } from "./config/utils";
import SensitiveDataFormSkeleton from "src/sensitiveData/components/sensitiveDataForm/SensitiveDataFormSkeleton";

const uniqueId = "ab02918f-d559-47ba-9662-ea6b3a3606d1";

// Define a type for the DATA_TEST_ID object with dynamic keys
type DataTestIdType = {
  SENSITIVE_DATA_CONTAINER: string;
  SENSITIVE_DATA_FORM_BUTTON: string;
  SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS: string;
  SENSITIVE_DATA_REJECT_BUTTON: string;
  SENSITIVE_DATA_SKIP_BUTTON: string;
  SENSITIVE_DATA_FORM_ERROR_MESSAGE: string;
  SENSITIVE_DATA_FORM_REFRESH_BUTTON: string;
  [key: string]: string; // Allow for dynamic keys
};

// Create a function to generate the DATA_TEST_ID object
const createDataTestId = (fields: FieldDefinition[]): DataTestIdType => {
  const baseIds = {
    // containers
    SENSITIVE_DATA_CONTAINER: `sensitive-data-container-${uniqueId}`,

    // action buttons
    SENSITIVE_DATA_FORM_BUTTON: `sensitive-data-form-button-${uniqueId}`,
    SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS: `sensitive-data-form-button-circular-progress-${uniqueId}`,
    SENSITIVE_DATA_REJECT_BUTTON: `sensitive-data-reject-button-${uniqueId}`,
    SENSITIVE_DATA_SKIP_BUTTON: `sensitive-data-skip-button-${uniqueId}`,
    SENSITIVE_DATA_FORM_ERROR_MESSAGE: `sensitive-data-form-error-message-${uniqueId}`,
    SENSITIVE_DATA_FORM_REFRESH_BUTTON: `sensitive-data-form-refresh-button-${uniqueId}`,
  };

  // Add dynamic field IDs
  const fieldIds = fields.reduce(
    (acc, field) => {
      acc[`SENSITIVE_DATA_FORM_${field.name.toUpperCase()}_INPUT`] =
        `sensitive-data-form-${field.name.toLowerCase()}-input-${uniqueId}`;
      return acc;
    },
    {} as Record<string, string>
  );

  return { ...baseIds, ...fieldIds };
};

// Initial DATA_TEST_ID with only base fields
export const DATA_TEST_ID: DataTestIdType = createDataTestId([]);

function isFormValid(result: Record<string, boolean>): boolean {
  for (let value of Object.values(result)) {
    if (!value) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitize the sensitive personal data before sending it to the server.
 * Currently, this only trims whitespace from string values.
 *
 * @param data - The sensitive personal data to sanitize.
 * @param fields - The field definitions from the configuration.
 * @returns A new object with sanitized data.
 */
const sanitize = (data: SensitivePersonalData, fields: FieldDefinition[]): SensitivePersonalData => {
  // Create a copy of the original data to avoid mutations
  const sanitizedData: SensitivePersonalData = { ...data };

  // Process each field
  for (const field of fields) {
    // Only process string fields
    if (field.type === FieldType.String) {
      const value = sanitizedData[field.name];

      // Ensure the value exists before trimming to avoid errors with null/undefined
      if (value) {
        // Remove leading and trailing whitespace
        sanitizedData[field.name] = String(value).trim();
      }
    }
  }

  return sanitizedData;
};

// Helper function to render form fields based on field type
const renderField = (
  field: FieldDefinition,
  handleFieldChange: (key: string, value: string | string[], isValid: boolean) => void,
  dataTestId: DataTestIdType,
  initialData: SensitivePersonalData
) => {
  const fieldTestId = dataTestId[`SENSITIVE_DATA_FORM_${field.name.toUpperCase()}_INPUT`];

  switch (field.type) {
    case FieldType.MultipleSelect:
      return (
        <MultipleSelectField
          key={field.name}
          field={field}
          dataTestId={fieldTestId}
          initialValue={Array.isArray(initialData[field.name]) ? (initialData[field.name] as string[]) : []}
          onChange={(values: string[], isValid: boolean) => handleFieldChange(field.name, values, isValid)}
        />
      );
    case FieldType.Enum:
      return (
        <EnumField
          key={field.name}
          field={field}
          dataTestId={fieldTestId}
          initialValue={
            typeof initialData[field.name] === "string"
              ? (initialData[field.name] as string)
              : (field.defaultValue ?? "")
          }
          onChange={(value: string, isValid: boolean) => handleFieldChange(field.name, value, isValid)}
        />
      );
    case FieldType.String:
    default:
      return (
        <StringField
          key={field.name}
          field={field}
          dataTestId={fieldTestId}
          initialValue={
            typeof initialData[field.name] === "string"
              ? (initialData[field.name] as string)
              : (field.defaultValue ?? "")
          }
          onChange={(value: string, isValid: boolean) => handleFieldChange(field.name, value, isValid)}
        />
      );
  }
};

const SensitiveDataForm: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  // Load the fields configuration
  const { fields, loading: configLoading, error: configError } = useFieldsConfig();

  // Update the DATA_TEST_ID when the configuration is loaded
  useEffect(() => {
    if (!configLoading && !configError) {
      // we use a global variable that is resigned when the config is loaded
      // because we want to export the DATA_TEST_ID object and use it in the tests
      Object.assign(DATA_TEST_ID, createDataTestId(fields));
    }
  }, [fields, configLoading, configError]);

  const [isSavingSensitiveData, setIsSavingSensitiveData] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [isSubmitButtonEnabled, setIsSubmitButtonEnabled] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [userPreferences] = useState<UserPreference | null>(
    UserPreferencesStateService.getInstance().getUserPreferences()
  );

  // Initialize with empty data, will be updated when config is loaded
  const [sensitiveData, setSensitiveData] = useState<SensitivePersonalData>({});

  // Update the sensitiveData when the configuration is loaded
  useEffect(() => {
    if (!configLoading && !configError) {
      // Initialize with default values
      setSensitiveData(createEmptySensitivePersonalData(fields));

      // Initialize validation state
      const initialValidation: Record<string, boolean> = {};

      // Set initial validation state based on field requirements
      fields.forEach((field) => {
        // Required fields start as invalid, non-required fields start as valid
        initialValidation[field.name] = !field.required;
      });

      setValidationErrors(initialValidation);

      // Check if the form is valid initially (will be false if there are required fields)
      setIsSubmitButtonEnabled(isFormValid(initialValidation));
    }
  }, [fields, configLoading, configError]);

  // Handle field change and validation
  const handleFieldChange = useCallback((key: string, value: string | string[], isValid: boolean) => {
    // Store the value
    setSensitiveData((prev) => ({ ...prev, [key]: value }));

    // Store the validation state
    setValidationErrors((prev) => ({ ...prev, [key]: isValid }));
  }, []);

  useEffect(() => {
    // Check if the form is valid after this change
    setIsSubmitButtonEnabled(isFormValid(validationErrors));
  }, [validationErrors]);

  const handleSaveSensitivePersonalData = useCallback(async () => {
    if (configLoading || configError) {
      console.warn("Config is still loading or an there is a config loading error", {
        details: {
          configLoading,
          configError,
        },
      });
      enqueueSnackbar(t("sensitiveData.components.sensitiveDataForm.failedToLoadConfig"), { variant: "error" });
      return;
    }

    // Check if the form is valid based on current validation state
    if (!isFormValid(validationErrors)) {
      console.warn("User attempted to submit invalid sensitive data form.");
      enqueueSnackbar(t("sensitiveData.components.sensitiveDataForm.invalidForm"), { variant: "error" });
      return;
    }

    setIsSavingSensitiveData(true);
    setIsSubmitButtonEnabled(false);

    try {
      await sensitivePersonalDataService.createSensitivePersonalData(
        sanitize(sensitiveData, fields),
        userPreferences!.user_id,
        fields
      );

      // Update user preferences to indicate that the user has sensitive personal data
      // so that the user is not prompted to provide this information again.
      // We set the state directly because we don't want to go to the server to get the updated the user preferences.
      UserPreferencesStateService.getInstance().setUserPreferences({
        ...userPreferences!,
        has_sensitive_personal_data: true,
      });

      // Store personal info for local use using our utility function
      PersistentStorageService.setPersonalInfo(extractPersonalInfo(sensitiveData, fields));
      console.info("User confirmed providing personal data and saved successfully.");

      enqueueSnackbar(t("sensitiveData.components.sensitiveDataForm.savedSuccess"), { variant: "success" });
      navigate(routerPaths.ROOT);
    } catch (e) {
      console.error("Failed to save personal data", e);
      let friendlyErrorMessage = t("sensitiveData.components.sensitiveDataForm.errorDefault");
      if (e instanceof RestAPIError) {
        friendlyErrorMessage = getUserFriendlyErrorMessage(e);
      } else if (e instanceof EncryptedDataTooLarge) {
        friendlyErrorMessage = t("sensitiveData.components.sensitiveDataForm.errorEncryptedDataTooLarge");
      }
      enqueueSnackbar(friendlyErrorMessage, { variant: "error" });

      setIsSavingSensitiveData(false);
      setIsSubmitButtonEnabled(true);
    }
  }, [configLoading, configError, validationErrors, enqueueSnackbar, sensitiveData, fields, userPreferences, navigate, t]);

  const handleRejectProvidingSensitiveData = useCallback(async () => {
    setIsRejecting(true);
    setConfirmingReject(false);
    setIsSubmitButtonEnabled(false);
    try {
      const authenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
      await authenticationService!.logout();
      console.info("User rejected providing sensitive data. Logging out user.");

      navigate(routerPaths.LANDING, { replace: true });
      enqueueSnackbar(t("consent.components.consentPage.snackbarLoggedOutSuccess"), { variant: "success" });
    } catch (e) {
      console.error("Failed to log out", e);
      enqueueSnackbar(t("consent.components.consentPage.snackbarLoggedOutFailure"), { variant: "error" });
    } finally {
      setIsSubmitButtonEnabled(true);
      setIsRejecting(false);
    }
  }, [enqueueSnackbar, navigate, t]);

  const handleSkipProvidingSensitiveData = useCallback(async () => {
    setIsSkipping(true);
    setConfirmingSkip(false);
    try {
      await sensitivePersonalDataService.skip(userPreferences!.user_id);

      // Update user preferences to indicate that the user has skipped sensitive personal data
      UserPreferencesStateService.getInstance().setUserPreferences({
        ...userPreferences!,
        has_sensitive_personal_data: true,
      });
      console.info("User skipped providing sensitive data.");

  enqueueSnackbar(t("sensitiveData.components.sensitiveDataForm.collectionSkipped"), { variant: "success" });
      navigate(routerPaths.ROOT);
    } catch (e) {
      console.error("Failed to skip personal data", e);
      let friendlyErrorMessage = t("sensitiveData.components.sensitiveDataForm.errorDefault");
      if (e instanceof RestAPIError) {
        friendlyErrorMessage = getUserFriendlyErrorMessage(e);
      }
      enqueueSnackbar(friendlyErrorMessage, { variant: "error" });
    } finally {
      setIsSkipping(false);
    }
  }, [enqueueSnackbar, navigate, userPreferences, t]);

  const isPIIRequired =
    userPreferences?.sensitive_personal_data_requirement === SensitivePersonalDataRequirement.REQUIRED;

  useEffect(() => {
    // something is not right, we should have user preferences at this point.
    if (!userPreferences) {
      const error = new UserPreferenceError("User preferences not found");
      console.error(error);
      enqueueSnackbar(t("sensitiveData.components.sensitiveDataForm.errorDefault"), { variant: "error" });
      throw error;
    }
  }, [enqueueSnackbar, userPreferences, t]);

  // Show error state if configuration failed to load
  if (configError) {
    return (
      <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.SENSITIVE_DATA_CONTAINER}>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%">
          <Box color="error.main" mb={2}>
            <Typography data-testid={DATA_TEST_ID.SENSITIVE_DATA_FORM_ERROR_MESSAGE}>
              {t("sensitiveData.components.sensitiveDataForm.failedToLoadConfig")}
            </Typography>
          </Box>
          <PrimaryButton
            variant="contained"
            color="primary"
            onClick={() => window.location.reload()}
            data-testid={DATA_TEST_ID.SENSITIVE_DATA_FORM_REFRESH_BUTTON}
          >
            {t("sensitiveData.components.sensitiveDataForm.refreshPage")}
          </PrimaryButton>
        </Box>
      </Container>
    );
  }

  return (
    <Suspense fallback={<SensitiveDataFormSkeleton />}>
      {configLoading ? (
        <SensitiveDataFormSkeleton />
      ) : (
        <>
          <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.SENSITIVE_DATA_CONTAINER}>
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              gap={theme.fixedSpacing(theme.tabiyaSpacing.lg)}
              width={"100%"}
              sx={{
                paddingX: isMobile ? theme.fixedSpacing(theme.tabiyaSpacing.sm) : theme.spacing(0),
                paddingBottom: (theme) => theme.fixedSpacing(theme.tabiyaSpacing.xl),
              }}
            >
              <AuthHeader
                title={t("sensitiveData.components.sensitiveDataForm.title")}
                subtitle={
                  <>
                    {t("sensitiveData.components.sensitiveDataForm.subtitle")}
                    {isPIIRequired
                      ? " " + t("sensitiveData.components.sensitiveDataForm.unskippableSubtitle")
                      : " " + t("sensitiveData.components.sensitiveDataForm.skippableSubtitle")}
                    <HelpTip icon={<PrivacyTipIcon />}>{t("sensitiveData.components.sensitiveDataForm.helpTipText")}</HelpTip>
                  </>
                }
              />

              <Box
                width={"100%"}
                display={"flex"}
                flexDirection={"column"}
                gap={theme.fixedSpacing(theme.tabiyaSpacing.lg)}
              >
                <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
                  {/* Dynamically render form fields based on configuration */}
                  {fields.map((field) => renderField(field, handleFieldChange, DATA_TEST_ID, sensitiveData))}
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
                  {isPIIRequired ? (
                    <CustomLink
                      data-testid={DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON}
                      disabled={isRejecting}
                      onClick={() => {
                        setConfirmingReject(true);
                      }}
                    >
                      {t("common.buttons.noThankYou")}
                    </CustomLink>
                  ) : (
                    <CustomLink
                      data-testid={DATA_TEST_ID.SENSITIVE_DATA_SKIP_BUTTON}
                      disabled={isSkipping}
                      disableWhenOffline
                      onClick={() => {
                        setConfirmingSkip(true);
                      }}
                    >
                      {t("common.buttons.skip")}
                    </CustomLink>
                  )}

                  <PrimaryButton
                    fullWidth
                    variant="contained"
                    color="primary"
                    disabled={!isSubmitButtonEnabled || isSkipping}
                    disableWhenOffline={true}
                    onClick={handleSaveSensitivePersonalData}
                    data-testid={DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON}
                  >
                    {isSavingSensitiveData ? (
                      <CircularProgress
                        title={"Saving"}
                        color={"secondary"}
                        size={theme.typography.h5.fontSize}
                        sx={{ marginTop: theme.tabiyaSpacing.xs, marginBottom: theme.tabiyaSpacing.xs }}
                        aria-label={"Saving"}
                        data-testid={DATA_TEST_ID.SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS}
                      />
                    ) : (
                      t("sensitiveData.components.sensitiveDataForm.startConversation")
                    )}
                  </PrimaryButton>
                </Box>
              </Box>
            </Box>
          </Container>
          <TextConfirmModalDialog
            isOpen={confirmingReject}
            title={t("common.modal.areYouSure")}
            textParagraphs={[
              {
                id: "1",
                text: (
                  <>
                    {t("sensitiveData.components.sensitiveDataForm.rejectParagraph1")}{" "}
                    <HighlightedSpan>{t("common.backdrop.loggingYouOut")}</HighlightedSpan>
                  </>
                ),
              },
              {
                id: "2",
                text: <>{t("common.modal.areYouSureYouWantToExit")}</>,
              },
            ]}
            onCancel={handleRejectProvidingSensitiveData}
            onDismiss={() => {
              setConfirmingReject(false);
            }}
            onConfirm={() => {
              setConfirmingReject(false);
            }}
            cancelButtonText={t("common.buttons.yesExit")}
            confirmButtonText={t("common.buttons.iWantToStay")}
          />
          <TextConfirmModalDialog
            isOpen={confirmingSkip}
            title={t("common.modal.areYouSure")}
            textParagraphs={[
              {
                id: "1",
                text: (
                  <>                  
                    {t("sensitiveData.components.sensitiveDataForm.skipParagraph1")}{" "}
                    <HighlightedSpan>{t("sensitiveData.components.sensitiveDataForm.skipParagraph1Highlighted")}</HighlightedSpan>
                  </>
                ),
              },
              {
                id: "2",
                text: <>{t("sensitiveData.components.sensitiveDataForm.areYouSureYouWantToSkip")}</>,
              },
            ]}
            onCancel={handleSkipProvidingSensitiveData}
            onDismiss={() => {
              setConfirmingSkip(false);
            }}
            onConfirm={() => {
              setConfirmingSkip(false);
            }}
            cancelButtonText={t("sensitiveData.components.sensitiveDataForm.yesSkip")}
            confirmButtonText={t("sensitiveData.components.sensitiveDataForm.shareData")}
          />
          <Backdrop isShown={isSkipping || isRejecting} message={isSkipping ? t("sensitiveData.components.sensitiveDataForm.skipping") : t("common.backdrop.loggingYouOut")} />
        </>
      )}
    </Suspense>
  );
};

export default SensitiveDataForm;
