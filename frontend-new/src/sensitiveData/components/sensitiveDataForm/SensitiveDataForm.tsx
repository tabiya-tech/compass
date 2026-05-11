import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import AuthPageShell from "src/auth/components/AuthPageShell/AuthPageShell";
import { SensitivePersonalData } from "src/sensitiveData/types";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { getUserFriendlyErrorMessage, RestAPIError } from "src/error/restAPIError/RestAPIError";
import { EncryptedDataTooLarge } from "src/sensitiveData/services/sensitivePersonalDataService/errors";
import { sensitivePersonalDataService } from "src/sensitiveData/services/sensitivePersonalDataService/sensitivePersonalData.service";
import TextConfirmModalDialog from "src/theme/textConfirmModalDialog/TextConfirmModalDialog";
import {
  FieldDefinition,
  FieldType,
  StringFieldDefinition,
  EnumFieldDefinition,
} from "src/sensitiveData/components/sensitiveDataForm/config/types";
import CustomLink from "src/theme/CustomLink/CustomLink";
import {
  SensitivePersonalDataRequirement,
  UserPreference,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { UserPreferenceError } from "src/error/commonErrors";
import { HighlightedSpan } from "src/consent/components/consentPage/Consent";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { extractPersonalInfo } from "./config/utils";
import SensitiveDataFormSkeleton from "src/sensitiveData/components/sensitiveDataForm/SensitiveDataFormSkeleton";
import InstitutionService, { InstitutionSummary, Programme } from "src/institutions/services/InstitutionService";
import { getDarkLogoUrl } from "src/envService";

const uniqueId = "ab02918f-d559-47ba-9662-ea6b3a3606d1";

export const DATA_TEST_ID = {
  SENSITIVE_DATA_CONTAINER: `sensitive-data-container-${uniqueId}`,
  SENSITIVE_DATA_FORM_BUTTON: `sensitive-data-form-button-${uniqueId}`,
  SENSITIVE_DATA_FORM_BUTTON_CIRCULAR_PROGRESS: `sensitive-data-form-button-circular-progress-${uniqueId}`,
  SENSITIVE_DATA_REJECT_BUTTON: `sensitive-data-reject-button-${uniqueId}`,
  SENSITIVE_DATA_SKIP_BUTTON: `sensitive-data-skip-button-${uniqueId}`,
  SENSITIVE_DATA_FORM_ERROR_MESSAGE: `sensitive-data-form-error-message-${uniqueId}`,
  SENSITIVE_DATA_FORM_REFRESH_BUTTON: `sensitive-data-form-refresh-button-${uniqueId}`,
  SENSITIVE_DATA_SCHOOL_YEAR_SELECT: `sensitive-data-school-year-select-${uniqueId}`,
};

// Static field definitions used for payload serialisation (encrypt/dataKey mapping).
// Institution and programme are handled via custom UI but still included here so
// the service knows to send them as plain (unencrypted) fields.
const STATIC_FIELDS: FieldDefinition[] = [
  new StringFieldDefinition({
    name: "firstName",
    dataKey: "first_name",
    type: FieldType.String,
    required: true,
    label: "First Name",
    encrypt: false,
  }),
  new StringFieldDefinition({
    name: "lastName",
    dataKey: "last_name",
    type: FieldType.String,
    required: true,
    label: "Last Name",
    encrypt: false,
  }),
  new StringFieldDefinition({
    name: "institution",
    dataKey: "institution_name",
    type: FieldType.String,
    required: true,
    label: "Institution",
    encrypt: false,
  }),
  new StringFieldDefinition({
    name: "programme",
    dataKey: "programme_name",
    type: FieldType.String,
    required: true,
    label: "Programme",
    encrypt: false,
  }),
  new StringFieldDefinition({
    name: "province",
    dataKey: "province",
    type: FieldType.String,
    required: false,
    label: "Province",
    encrypt: false,
  }),
  new EnumFieldDefinition({
    name: "schoolYear",
    dataKey: "school_year",
    type: FieldType.Enum,
    required: true,
    label: "School Year",
    encrypt: false,
    values: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"],
  }),
];

function isFormValid(result: Record<string, boolean>): boolean {
  return Object.values(result).every(Boolean);
}

const sanitize = (data: SensitivePersonalData): SensitivePersonalData => {
  const sanitized: SensitivePersonalData = { ...data };
  for (const key of Object.keys(sanitized)) {
    if (typeof sanitized[key] === "string") {
      sanitized[key] = (sanitized[key] as string).trim();
    }
  }
  return sanitized;
};

const INSTITUTION_SEARCH_MIN_CHARS = 2;
const INSTITUTION_SEARCH_DEBOUNCE_MS = 400;

const SensitiveDataForm: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logoSrc = getDarkLogoUrl() || `${process.env.PUBLIC_URL}/njila-logo-dark.svg`;
  const { enqueueSnackbar } = useSnackbar();

  const [isSavingSensitiveData, setIsSavingSensitiveData] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [isSubmitButtonEnabled, setIsSubmitButtonEnabled] = useState(false);
  const [userPreferences] = useState<UserPreference | null>(
    UserPreferencesStateService.getInstance().getUserPreferences()
  );

  // Form field values
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState<InstitutionSummary | null>(null);
  const [institutionInputValue, setInstitutionInputValue] = useState("");
  const [selectedProgramme, setSelectedProgramme] = useState("");

  // Pilot: pre-assigned institution (locks the field)
  const [assignedInstitution, setAssignedInstitution] = useState<InstitutionSummary | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(true);

  // Institution autocomplete state
  const [institutionOptions, setInstitutionOptions] = useState<InstitutionSummary[]>([]);
  const [institutionLoading, setInstitutionLoading] = useState(false);

  // Programmes dropdown state
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [programmesLoading, setProgrammesLoading] = useState(false);

  // Validation errors per field (true = valid)
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({
    firstName: false,
    lastName: false,
    institution: false,
    programme: false,
    schoolYear: false,
  });

  // Only surface per-field error UI after a failed submit; while typing we stay quiet.
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const firstNameRef = useRef<HTMLDivElement | null>(null);
  const lastNameRef = useRef<HTMLDivElement | null>(null);
  const institutionRef = useRef<HTMLDivElement | null>(null);
  const programmeRef = useRef<HTMLDivElement | null>(null);
  const schoolYearRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const valid = isFormValid(validationErrors);
    setIsSubmitButtonEnabled(valid);
    if (valid) setShowFieldErrors(false);
  }, [validationErrors]);

  const setFieldValid = useCallback((name: string, isValid: boolean) => {
    setValidationErrors((prev) => ({ ...prev, [name]: isValid }));
  }, []);

  // --- Institution search with debounce ---
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInstitutionInputChange = useCallback(
    (_event: React.SyntheticEvent, value: string) => {
      setInstitutionInputValue(value);

      // Clear institution & programme when user clears or changes input
      if (!value) {
        setSelectedInstitution(null);
        setSelectedProgramme("");
        setProgrammes([]);
        setFieldValid("institution", false);
        setFieldValid("programme", false);
      }

      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

      if (value.length < INSTITUTION_SEARCH_MIN_CHARS) {
        setInstitutionOptions([]);
        return;
      }

      searchTimerRef.current = setTimeout(async () => {
        setInstitutionLoading(true);
        try {
          const result = await InstitutionService.getInstance().searchInstitutions(value, 10);
          setInstitutionOptions(result.data);
        } catch (e) {
          console.error("Institution search failed", e);
          setInstitutionOptions([]);
        } finally {
          setInstitutionLoading(false);
        }
      }, INSTITUTION_SEARCH_DEBOUNCE_MS);
    },
    [setFieldValid]
  );

  const handleInstitutionSelect = useCallback(
    async (_event: React.SyntheticEvent, institution: InstitutionSummary | null) => {
      setSelectedInstitution(institution);
      setSelectedProgramme("");
      setProgrammes([]);
      setFieldValid("programme", false);

      if (!institution) {
        setFieldValid("institution", false);
        return;
      }

      setFieldValid("institution", true);

      if (!institution.reg_no) return;

      setProgrammesLoading(true);
      try {
        const result = await InstitutionService.getInstance().getProgrammesByInstitution(institution.reg_no);
        setProgrammes(result.programmes ?? []);
      } catch (e) {
        console.error("Failed to load programmes", e);
        enqueueSnackbar(t("sensitiveData.components.sensitiveDataForm.failedToLoadProgrammes"), { variant: "warning" });
      } finally {
        setProgrammesLoading(false);
      }
    },
    [setFieldValid, enqueueSnackbar, t]
  );

  // Build the sensitiveData payload from current field state
  const buildSensitiveData = useCallback(
    (): SensitivePersonalData => ({
      firstName,
      lastName,
      institution: selectedInstitution?.name ?? "",
      programme: selectedProgramme,
      province: selectedInstitution?.province ?? "",
      schoolYear,
    }),
    [firstName, lastName, selectedInstitution, selectedProgramme, schoolYear]
  );

  const handleSaveSensitivePersonalData = useCallback(async () => {
    if (!isFormValid(validationErrors)) {
      setShowFieldErrors(true);
      enqueueSnackbar(t("sensitiveData.components.sensitiveDataForm.invalidForm"), { variant: "error" });
      const orderedRefs: Array<[string, React.RefObject<HTMLDivElement | null>]> = [
        ["firstName", firstNameRef],
        ["lastName", lastNameRef],
        ["institution", institutionRef],
        ["programme", programmeRef],
        ["schoolYear", schoolYearRef],
      ];
      const firstInvalid = orderedRefs.find(([name]) => !validationErrors[name]);
      firstInvalid?.[1].current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setIsSavingSensitiveData(true);
    setIsSubmitButtonEnabled(false);

    try {
      const data = sanitize(buildSensitiveData());
      await sensitivePersonalDataService.createSensitivePersonalData(data, userPreferences!.user_id, STATIC_FIELDS);

      UserPreferencesStateService.getInstance().setUserPreferences({
        ...userPreferences!,
        has_sensitive_personal_data: true,
      });

      PersistentStorageService.setPersonalInfo(extractPersonalInfo(data, STATIC_FIELDS));
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
  }, [validationErrors, enqueueSnackbar, t, buildSensitiveData, userPreferences, navigate]);

  const handleRejectProvidingSensitiveData = useCallback(async () => {
    setIsRejecting(true);
    setConfirmingReject(false);
    setIsSubmitButtonEnabled(false);
    try {
      const authenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
      await authenticationService!.logout();
      navigate(routerPaths.LOGIN, { replace: true });
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
      UserPreferencesStateService.getInstance().setUserPreferences({
        ...userPreferences!,
        has_sensitive_personal_data: true,
      });
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
    if (!userPreferences) {
      const error = new UserPreferenceError("User preferences not found");
      console.error(error);
      enqueueSnackbar(t("sensitiveData.components.sensitiveDataForm.errorDefault"), { variant: "error" });
      throw error;
    }
  }, [enqueueSnackbar, userPreferences, t]);

  // Fetch pilot institution assignment on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const assignment = await InstitutionService.getInstance().getInstitutionAssignment();
        if (cancelled) return;
        if (assignment) {
          const institution: InstitutionSummary = {
            name: assignment.institution_name,
            reg_no: assignment.reg_no ?? undefined,
          };
          setAssignedInstitution(institution);
          setSelectedInstitution(institution);
          setInstitutionInputValue(institution.name);
          setFieldValid("institution", true);
          // Auto-load programmes for the assigned institution
          if (assignment.reg_no) {
            setProgrammesLoading(true);
            try {
              const result = await InstitutionService.getInstance().getProgrammesByInstitution(assignment.reg_no);
              if (!cancelled) setProgrammes(result.programmes ?? []);
            } catch (e) {
              console.error("Failed to load programmes for assigned institution", e);
            } finally {
              if (!cancelled) setProgrammesLoading(false);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch institution assignment", e);
      } finally {
        if (!cancelled) setAssignmentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const whiteBandContent = (
    <Container
      maxWidth="sm"
      disableGutters
      sx={{
        pt: { xs: theme.fixedSpacing(theme.tabiyaSpacing.xl), md: theme.fixedSpacing(theme.tabiyaSpacing.sm) },
        pb: theme.fixedSpacing(theme.tabiyaSpacing.xl),
      }}
      data-testid={DATA_TEST_ID.SENSITIVE_DATA_CONTAINER}
    >
      <Box
        sx={{
          backgroundColor: "common.white",
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 4,
          width: "100%",
          maxWidth: 560,
          mx: "auto",
          padding: {
            xs: theme.fixedSpacing(theme.tabiyaSpacing.xl),
            md: theme.fixedSpacing(theme.tabiyaSpacing.xl * 1.25),
          },
        }}
      >
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="space-evenly"
          gap={theme.fixedSpacing(theme.tabiyaSpacing.lg)}
          width={"100%"}
        >
          <Box>
            <Typography variant="h1" color="primary.main" gutterBottom>
              {t("sensitiveData.components.sensitiveDataForm.title")}
            </Typography>
            <Typography variant="body2">
              {t("sensitiveData.components.sensitiveDataForm.subtitle")}
              {isPIIRequired
                ? " " + t("sensitiveData.components.sensitiveDataForm.unskippableSubtitle")
                : " " + t("sensitiveData.components.sensitiveDataForm.skippableSubtitle")}
            </Typography>
          </Box>

          <Box
            width={"100%"}
            display={"flex"}
            flexDirection={"column"}
            gap={theme.fixedSpacing(theme.tabiyaSpacing.lg)}
          >
            <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
              {/* First Name */}
              <TextField
                fullWidth
                required
                label="First Name"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => {
                  const val = e.target.value.trimStart();
                  setFirstName(val);
                  setFieldValid("firstName", val.trim().length > 0);
                }}
                inputRef={firstNameRef}
                error={showFieldErrors && !validationErrors.firstName}
                helperText={
                  showFieldErrors && !validationErrors.firstName
                    ? t("sensitiveData.components.sensitiveDataForm.fieldRequired")
                    : ""
                }
              />

              {/* Last Name */}
              <TextField
                fullWidth
                required
                label="Last Name"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => {
                  const val = e.target.value.trimStart();
                  setLastName(val);
                  setFieldValid("lastName", val.trim().length > 0);
                }}
                inputRef={lastNameRef}
                error={showFieldErrors && !validationErrors.lastName}
                helperText={
                  showFieldErrors && !validationErrors.lastName
                    ? t("sensitiveData.components.sensitiveDataForm.fieldRequired")
                    : ""
                }
              />

              {/* Institution — locked for pilot users, searchable for regular users */}
              {assignedInstitution ? (
                <TextField
                  fullWidth
                  required
                  label="Institution"
                  value={assignedInstitution.name}
                  inputRef={institutionRef}
                  slotProps={{ input: { readOnly: true } }}
                />
              ) : (
                <Autocomplete
                  options={institutionOptions}
                  getOptionLabel={(option) => option.name}
                  loading={institutionLoading || assignmentLoading}
                  disabled={assignmentLoading}
                  inputValue={institutionInputValue}
                  value={selectedInstitution}
                  filterOptions={(x) => x}
                  isOptionEqualToValue={(option, value) => option.name === value.name}
                  onInputChange={handleInstitutionInputChange}
                  onChange={handleInstitutionSelect}
                  noOptionsText={
                    institutionInputValue.length < INSTITUTION_SEARCH_MIN_CHARS
                      ? "Type at least 2 characters to search"
                      : institutionLoading
                        ? "Searching..."
                        : "No institutions found"
                  }
                  renderOption={(props, option) => (
                    <li {...props} key={option.name}>
                      <Box display="flex" justifyContent="space-between" width="100%">
                        <Typography variant="body2">{option.name}</Typography>
                        {option.province && (
                          <Typography variant="body2" color="text.secondary" sx={{ ml: 2, flexShrink: 0 }}>
                            {option.province}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      required
                      label="Institution"
                      placeholder="Start typing to search..."
                      inputRef={institutionRef}
                      error={showFieldErrors && !validationErrors.institution}
                      helperText={
                        showFieldErrors && !validationErrors.institution
                          ? t("sensitiveData.components.sensitiveDataForm.fieldRequired")
                          : ""
                      }
                      slotProps={{
                        input: {
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {institutionLoading ? <CircularProgress color="inherit" size={16} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        },
                      }}
                    />
                  )}
                />
              )}

              {/* Programme — searchable autocomplete, disabled until institution is chosen */}
              <Autocomplete
                options={programmes}
                getOptionLabel={(option) => option.name}
                disabled={!selectedInstitution || programmesLoading}
                loading={programmesLoading}
                value={programmes.find((p) => p.name === selectedProgramme) ?? null}
                onChange={(_event, programme) => {
                  const val = programme?.name ?? "";
                  setSelectedProgramme(val);
                  setFieldValid("programme", !!val);
                }}
                noOptionsText={
                  !selectedInstitution
                    ? "Select an institution first"
                    : programmesLoading
                      ? "Loading programmes..."
                      : "No programmes available"
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    required
                    label="Programme"
                    placeholder={selectedInstitution ? "Select programme" : "Select an institution first"}
                    inputRef={programmeRef}
                    error={showFieldErrors && !validationErrors.programme}
                    helperText={
                      showFieldErrors && !validationErrors.programme
                        ? t("sensitiveData.components.sensitiveDataForm.fieldRequired")
                        : ""
                    }
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {programmesLoading ? <CircularProgress color="inherit" size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      },
                    }}
                  />
                )}
              />

              {/* School Year */}
              <FormControl fullWidth required error={showFieldErrors && !validationErrors.schoolYear}>
                <InputLabel id="school-year-label">School Year</InputLabel>
                <Select
                  value={schoolYear}
                  label="School Year"
                  labelId="school-year-label"
                  inputRef={schoolYearRef}
                  SelectDisplayProps={
                    {
                      "data-testid": DATA_TEST_ID.SENSITIVE_DATA_SCHOOL_YEAR_SELECT,
                    } as React.HTMLAttributes<HTMLDivElement>
                  }
                  onChange={(e) => {
                    setSchoolYear(e.target.value);
                    setFieldValid("schoolYear", !!e.target.value);
                  }}
                >
                  {["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"].map((yr) => (
                    <MenuItem key={yr} value={yr}>
                      {yr}
                    </MenuItem>
                  ))}
                </Select>
                {showFieldErrors && !validationErrors.schoolYear && (
                  <Typography variant="caption" color="error" sx={{ marginLeft: 1.75, marginTop: 0.5 }}>
                    {t("sensitiveData.components.sensitiveDataForm.fieldRequired")}
                  </Typography>
                )}
              </FormControl>
            </Box>

            <Box
              sx={{
                width: "100%",
                display: "flex",
                flexDirection: { xs: "column-reverse", sm: "row" },
                justifyContent: { xs: "center", sm: "space-between" },
                alignItems: "center",
                gap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
              }}
            >
              {isPIIRequired ? (
                <CustomLink
                  data-testid={DATA_TEST_ID.SENSITIVE_DATA_REJECT_BUTTON}
                  disabled={isRejecting}
                  onClick={() => setConfirmingReject(true)}
                  sx={{ alignSelf: { xs: "center", sm: "auto" }, textAlign: "center" }}
                >
                  {t("common.buttons.noThankYou")}
                </CustomLink>
              ) : (
                <CustomLink
                  data-testid={DATA_TEST_ID.SENSITIVE_DATA_SKIP_BUTTON}
                  disabled={isSkipping}
                  disableWhenOffline
                  onClick={() => setConfirmingSkip(true)}
                  sx={{ alignSelf: { xs: "center", sm: "auto" }, textAlign: "center" }}
                >
                  {t("common.buttons.skip")}
                </CustomLink>
              )}

              <PrimaryButton
                showCircle
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
      </Box>
    </Container>
  );

  return (
    <Suspense fallback={<SensitiveDataFormSkeleton />}>
      <>
        <AuthPageShell
          logoUrl={logoSrc}
          whiteBandContent={whiteBandContent}
          whiteBandBackgroundColor={theme.palette.containerBackground.main}
        />
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
            { id: "2", text: <>{t("common.modal.areYouSureYouWantToExit")}</> },
          ]}
          onCancel={handleRejectProvidingSensitiveData}
          onDismiss={() => setConfirmingReject(false)}
          onConfirm={() => setConfirmingReject(false)}
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
                  <HighlightedSpan>
                    {t("sensitiveData.components.sensitiveDataForm.skipParagraph1Highlighted")}
                  </HighlightedSpan>
                </>
              ),
            },
            { id: "2", text: <>{t("sensitiveData.components.sensitiveDataForm.areYouSureYouWantToSkip")}</> },
          ]}
          onCancel={handleSkipProvidingSensitiveData}
          onDismiss={() => setConfirmingSkip(false)}
          onConfirm={() => setConfirmingSkip(false)}
          cancelButtonText={t("sensitiveData.components.sensitiveDataForm.yesSkip")}
          confirmButtonText={t("sensitiveData.components.sensitiveDataForm.shareData")}
        />

        <Backdrop
          isShown={isSkipping || isRejecting}
          message={
            isSkipping ? t("sensitiveData.components.sensitiveDataForm.skipping") : t("common.backdrop.loggingYouOut")
          }
        />
      </>
    </Suspense>
  );
};

export default SensitiveDataForm;
