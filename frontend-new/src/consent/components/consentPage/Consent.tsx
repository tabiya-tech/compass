import React, { useCallback, useState } from "react";
import { Box, Container, Checkbox, styled, Typography, useTheme, FormControlLabel } from "@mui/material";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import {
  SensitivePersonalDataRequirement,
  Language,
  UpdateUserPreferencesSpec,
} from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { useNavigate } from "react-router-dom";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { routerPaths } from "src/app/routerPaths";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import authStateService from "src/auth/services/AuthenticationState.service";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import { StyledAnchor } from "src/theme/StyledAnchor/StyledAnchor";

const uniqueId = "1dee3ba4-1853-40c6-aaad-eeeb0e94788d";

const HighlightedSpan = styled("span")(({ theme }) => ({
  backgroundColor: theme.palette.tabiyaYellow.light,
}));

export const DATA_TEST_ID = {
  DPA_CONTAINER: `dpa-container-${uniqueId}`,
  LOGO: `dpa-logo-${uniqueId}`,
  TITLE: `dpa-title-${uniqueId}`,
  AGREEMENT_BODY: `dpa-agreement-body-${uniqueId}`,
  DPA: `dpa-form-${uniqueId}`,
  LANGUAGE_SELECTOR: `dpa-language-selector-${uniqueId}`,
  ACCEPT_DPA_BUTTON: `dpa-accept-button-${uniqueId}`,
  REJECT_DPA_BUTTON: `dpa-reject-button-${uniqueId}`,
  CIRCULAR_PROGRESS: `dpa-circular-progress-${uniqueId}`,
  ACCEPT_DPA_CHECKBOX_CONTAINER: `dpa-accept-dpa-checkbox-container-${uniqueId}`,
  ACCEPT_DPA_CHECKBOX_TEXT: `dpa-accept-dpa-text-${uniqueId}`,
  ACCEPT_TERMS_AND_CONDITIONS_TEXT: `dpa-accept-tc-text-${uniqueId}`,
  ACCEPT_TERMS_AND_CONDITIONS_CHECKBOX_CONTAINER: `dpa-accept-tc-checkbox-container-${uniqueId}`,
};

const Consent: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [isAcceptingDPA, setIsAcceptingDPA] = useState(false);
  const [isRejectingDPA, setIsRejectingDPA] = useState(false);
  const [isTCAccepted, setIsTCAccepted] = useState(false);
  const [isDPAccepted, setIsDPAccepted] = useState(false);

  const { enqueueSnackbar } = useSnackbar();

  const userPreferences = userPreferencesStateService.getUserPreferences();

  /**
   * Persist the user's chosen preferences to the backend
   */
  const persistUserPreferences = useCallback(async () => {
    try {
      const user = authStateService.getInstance().getUser();
      if (!user) {
        enqueueSnackbar("User not found", { variant: "error" });
        navigate(routerPaths.LOGIN);
        return;
      }

      const newUserPreferenceSpecs: UpdateUserPreferencesSpec = {
        user_id: user.id,
        language: Language.en,
        accepted_tc: new Date(),
      };
      setIsAcceptingDPA(true);
      const prefs = await userPreferencesService.updateUserPreferences(newUserPreferenceSpecs);

      userPreferencesStateService.setUserPreferences({
        ...prefs,
        sensitive_personal_data_requirement: userPreferences?.sensitive_personal_data_requirement!,
      });

      if (userPreferences?.sensitive_personal_data_requirement! === SensitivePersonalDataRequirement.REQUIRED) {
        navigate(routerPaths.SENSITIVE_DATA, { replace: true });
      } else {
        navigate(routerPaths.ROOT, { replace: true });
      }

      enqueueSnackbar("Data Protection Agreement Accepted", { variant: "success" });
    } catch (e) {
      if (e instanceof ServiceError) {
        writeServiceErrorToLog(e, console.error);
        enqueueSnackbar(getUserFriendlyErrorMessage(e), { variant: "error" });
      } else {
        enqueueSnackbar(`Failed to update user preferences: ${(e as Error).message}`, { variant: "error" });
        console.error("Failed to update user preferences", e);
      }
    } finally {
      setIsAcceptingDPA(false);
    }
  }, [enqueueSnackbar, navigate, userPreferences]);

  /**
   * Handle when a user accepts the data protection agreement
   */
  const handleAcceptedDPA = async () => {
    await persistUserPreferences();
  };

  /**
   * Handle when a user rejects the data protection agreement
   */
  const handleRejectedDPA = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();

      setIsRejectingDPA(true);

      try {
        const authenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
        await authenticationService!.logout();
        navigate(routerPaths.LOGIN, { replace: true });
        enqueueSnackbar("Successfully logged out.", { variant: "success" });
      } catch (e) {
        console.error("Failed to log out", e);
        enqueueSnackbar("Failed to log out.", { variant: "error" });
      } finally {
        setIsRejectingDPA(false);
      }
    },
    [enqueueSnackbar, navigate]
  );

  /**
   * Handle when a user checks terms and conditions checkbox
   */
  const handleTCChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsTCAccepted(event.target.checked);
  };

  /**
   * Handle when a user checks the data protection agreement checkbox
   */
  const handleDPAChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsDPAccepted(event.target.checked);
  };

  const termsAndConditionsLabel = "Terms and Conditions";
  const dataProtectionAgreementLabel = "Data Protection Agreement";

  return (
    <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.DPA_CONTAINER}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="start"
        justifyContent={"space-evenly"}
        gap={theme.tabiyaSpacing.lg}
      >
        <AuthHeader title={"Before we begin..."} subtitle={""} />
        <Typography variant="body2" gutterBottom data-testid={DATA_TEST_ID.AGREEMENT_BODY}>
          We created this AI tool for you with care to help you and other young people like you explore their skills and
          discover new opportunities.
          <br />
          <br />
          <HighlightedSpan>Please use AI responsibly!</HighlightedSpan>
          <br />
          <br />
          AI technology is new and far from perfect. It doesn't understand context like humans do.
          <br />
          <br />
          Always double-check important details and avoid sharing personal information about yourself and others with
          the AI during the conversation.
          <br />
          <br />
          Help us keep all AI interactions safe and positive! 😊
        </Typography>
        <Box display={"flex"} flexDirection={"column"} gap={theme.tabiyaSpacing.lg}>
          <FormControlLabel
            control={
              <Checkbox
                checked={isTCAccepted}
                onChange={handleTCChange}
                inputProps={{
                  "aria-label": termsAndConditionsLabel,
                }}
                data-testid={DATA_TEST_ID.ACCEPT_TERMS_AND_CONDITIONS_CHECKBOX_CONTAINER}
              />
            }
            sx={{ alignItems: "flex-start" }}
            label={
              <Typography variant="body2" data-testid={DATA_TEST_ID.ACCEPT_TERMS_AND_CONDITIONS_TEXT}>
                I have read and accept the{" "}
                <StyledAnchor href="https://compass.tabiya.org/dpa.html" target="_blank" rel="noreferrer">
                  {termsAndConditionsLabel}
                </StyledAnchor>{" "}
                of Compass.
              </Typography>
            }
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={isDPAccepted}
                onChange={handleDPAChange}
                inputProps={{
                  "aria-label": dataProtectionAgreementLabel,
                }}
                data-testid={DATA_TEST_ID.ACCEPT_DPA_CHECKBOX_CONTAINER}
              />
            }
            sx={{ alignItems: "flex-start" }}
            label={
              <Typography variant="body2" data-testid={DATA_TEST_ID.ACCEPT_DPA_CHECKBOX_TEXT}>
                I have read and accept the{" "}
                <StyledAnchor href="https://compass.tabiya.org/dpa.html" target="_blank" rel="noreferrer">
                  {dataProtectionAgreementLabel}
                </StyledAnchor>{" "}
                of Compass.
              </Typography>
            }
          />
        </Box>
        <Typography>
          Are you ready to start?
          <br />
        </Typography>
        <Box
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: theme.spacing(2),
            gap: theme.tabiyaSpacing.xl,
          }}
        >
          <StyledAnchor data-testid={DATA_TEST_ID.REJECT_DPA_BUTTON} onClick={handleRejectedDPA}>
            No, thank you
          </StyledAnchor>
          <PrimaryButton
            fullWidth
            variant="contained"
            color="primary"
            disabled={isAcceptingDPA || !isTCAccepted || !isDPAccepted || isRejectingDPA}
            disableWhenOffline={true}
            data-testid={DATA_TEST_ID.ACCEPT_DPA_BUTTON}
            onClick={handleAcceptedDPA}
          >
            Sure, I am ready
          </PrimaryButton>
        </Box>
      </Box>
    </Container>
  );
};

export default Consent;
