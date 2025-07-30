import React, { useCallback, useState } from "react";
import { Box, Container, Checkbox, styled, Typography, useTheme, FormControlLabel, useMediaQuery } from "@mui/material";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Language, UpdateUserPreferencesSpec } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { getUserFriendlyErrorMessage, RestAPIError } from "src/error/restAPIError/RestAPIError";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { useNavigate } from "react-router-dom";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { routerPaths } from "src/app/routerPaths";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import authStateService from "src/auth/services/AuthenticationState.service";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import { AuthenticationError } from "src/error/commonErrors";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import { Theme } from "@mui/material/styles";
import ConfirmModalDialog from "src/theme/confirmModalDialog/ConfirmModalDialog";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { isSensitiveDataValid } from "src/app/ProtectedRoute/util";
import { DeviceSpecificationEvent, EventType, UserLocationEvent } from "src/metrics/types";
import { browserName, deviceType, osName, browserVersion } from "react-device-detect";
import { getCoordinates } from "src/metrics/utils/getUserLocation";
import MetricsService from "src/metrics/metricsService";

const uniqueId = "1dee3ba4-1853-40c6-aaad-eeeb0e94788d";

export const HighlightedSpan = styled("span")(({ theme }) => ({
  backgroundColor: theme.palette.tabiyaYellow.light,
}));

export const DATA_TEST_ID = {
  CONSENT_CONTAINER: `consent-container-${uniqueId}`,
  LOGO: `consent-logo-${uniqueId}`,
  TITLE: `consent-title-${uniqueId}`,
  AGREEMENT_BODY: `consent-agreement-body-${uniqueId}`,
  CONSENT_FORM: `consent-form-${uniqueId}`,
  LANGUAGE_SELECTOR: `consent-language-selector-${uniqueId}`,
  ACCEPT_BUTTON: `consent-accept-button-${uniqueId}`,
  REJECT_BUTTON: `consent-reject-button-${uniqueId}`,
  CIRCULAR_PROGRESS: `consent-circular-progress-${uniqueId}`,
  ACCEPT_CHECKBOX_CONTAINER: `consent-accept-consent-checkbox-container-${uniqueId}`,
  ACCEPT_CHECKBOX_TEXT: `consent-accept-consent-text-${uniqueId}`,
  ACCEPT_TERMS_AND_CONDITIONS_TEXT: `consent-accept-tc-text-${uniqueId}`,
  ACCEPT_TERMS_AND_CONDITIONS_CHECKBOX_CONTAINER: `consent-accept-tc-checkbox-container-${uniqueId}`,
  SUPPORT_CONTAINER: `consent-support-container-${uniqueId}`,
  GOOGLE_LOGO: `consent-google-logo-${uniqueId}`,
};

const Consent: React.FC = () => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const navigate = useNavigate();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isTCAccepted, setIsTCAccepted] = useState(false);
  const [isDPAccepted, setIsDPAccepted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { enqueueSnackbar } = useSnackbar();

  const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();

  function sendMetricsEvent(user_id: string): void {
    setTimeout(async () => {
      // we put the metrics gathering and reporting in an immediate setTimeout to avoid blocking the main thread
      try {
        // Get device specifications
        const deviceEvent: DeviceSpecificationEvent = {
          event_type: EventType.DEVICE_SPECIFICATION,
          user_id: user_id,
          browser_type: browserName,
          device_type: deviceType,
          os_type: osName,
          browser_version: browserVersion,
          user_agent: navigator.userAgent || "UNAVAILABLE",
          timestamp: new Date().toISOString(),
        };
        MetricsService.getInstance().sendMetricsEvent(deviceEvent);
      } catch (error) {
        console.error("An error occurred while trying to send metrics events", error);
      }

      try {
        // Get user's location if they allow it
        const coordinates = await getCoordinates();
        if (coordinates[0] == null || coordinates[1] == null || isNaN(coordinates[0]) || isNaN(coordinates[1])) {
          console.warn("Coordinates could not be retrieved or are invalid");
          return;
        }
        const locationEvent: UserLocationEvent = {
          event_type: EventType.USER_LOCATION,
          user_id: user_id,
          coordinates: coordinates,
          timestamp: new Date().toISOString(),
        };
        MetricsService.getInstance().sendMetricsEvent(locationEvent);
      } catch (err) {
        if (err instanceof GeolocationPositionError) {
          console.warn("Location could not be retrieved", err);
        } else {
          console.error("An error occurred while trying to get user's location", err);
        }
      }
    });
  }

  /**
   * Persist the user's chosen preferences to the backend
   */
  const persistUserPreferences = useCallback(async () => {
    try {
      const user = authStateService.getInstance().getUser();
      if (!user) {
        enqueueSnackbar("User not found", { variant: "error" });
        navigate(routerPaths.LANDING);
        return;
      }

      const newUserPreferenceSpecs: UpdateUserPreferencesSpec = {
        user_id: user.id,
        language: Language.en,
        accepted_tc: new Date(),
      };
      setIsAccepting(true);
      const prefs = await UserPreferencesService.getInstance().updateUserPreferences(newUserPreferenceSpecs);

      UserPreferencesStateService.getInstance().setUserPreferences({
        ...prefs,
        sensitive_personal_data_requirement: userPreferences?.sensitive_personal_data_requirement!,
      });

      if (!isSensitiveDataValid(userPreferences!)) {
        navigate(routerPaths.SENSITIVE_DATA, { replace: true });
      } else {
        navigate(routerPaths.ROOT, { replace: true });
      }

      sendMetricsEvent(prefs.user_id);

      enqueueSnackbar("Agreement Accepted", { variant: "success" });
    } catch (e: unknown) {
      console.error(new AuthenticationError("Failed to update user preferences", e));
      if (e instanceof RestAPIError) {
        enqueueSnackbar(getUserFriendlyErrorMessage(e), { variant: "error" });
      } else {
        enqueueSnackbar(`Failed to update user preferences: ${(e as Error).message}`, { variant: "error" });
      }
    } finally {
      setIsAccepting(false);
    }
  }, [enqueueSnackbar, navigate, userPreferences]);

  /**
   * Handle when a user accepts the agreements
   */
  const handleAcceptedDPA = async () => {
    await persistUserPreferences();
  };

  /**
   * Handle when a user rejects consent
   */
  const handleRejected = useCallback(async () => {
    setShowRejectModal(false);
    setIsRejecting(true);
    setIsLoggingOut(true);

    try {
      const authenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
      await authenticationService!.logout();
      navigate(routerPaths.LANDING, { replace: true });
      enqueueSnackbar("Successfully logged out.", { variant: "success" });
    } catch (e) {
      console.error(new AuthenticationError("Failed to log out", e));
      enqueueSnackbar("Failed to log out.", { variant: "error" });
    } finally {
      setIsRejecting(false);
    }
  }, [enqueueSnackbar, navigate]);

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
  const privacyPolicyLabel = "Privacy Policy";

  const handleExternalNavigationOnNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Container
      maxWidth="xs"
      sx={{ height: "100%", padding: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}
      data-testid={DATA_TEST_ID.CONSENT_CONTAINER}
    >
      <Backdrop isShown={isLoggingOut} message={"Logging you out..."} />
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent={"space-evenly"}>
        <AuthHeader title={"Before we begin..."} subtitle={<></>} />
        <Box
          display={"flex"}
          flexDirection={"column"}
          textAlign={"start"}
          width={"100%"}
          gap={theme.fixedSpacing(theme.tabiyaSpacing.lg)}
        >
          <Typography variant="body2" gutterBottom data-testid={DATA_TEST_ID.AGREEMENT_BODY}>
            We created this AI tool for you with care to help you and other young people like you explore their skills
            and discover new opportunities.
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
                  <CustomLink onClick={() => handleExternalNavigationOnNewTab("https://www.tabiya.org/compass/terms")}>
                    {termsAndConditionsLabel}
                  </CustomLink>{" "}
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
                    "aria-label": privacyPolicyLabel,
                  }}
                  data-testid={DATA_TEST_ID.ACCEPT_CHECKBOX_CONTAINER}
                />
              }
              sx={{ alignItems: "flex-start" }}
              label={
                <Typography variant="body2" data-testid={DATA_TEST_ID.ACCEPT_CHECKBOX_TEXT}>
                  I have read and accept the{" "}
                  <CustomLink
                    onClick={() => handleExternalNavigationOnNewTab("https://www.tabiya.org/compass/privacy")}
                  >
                    {privacyPolicyLabel}
                  </CustomLink>{" "}
                  of Compass.
                </Typography>
              }
            />
          </Box>
          <Typography>
            Are you ready to start?
            <br />
          </Typography>
        </Box>
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
          <CustomLink data-testid={DATA_TEST_ID.REJECT_BUTTON} onClick={() => setShowRejectModal(true)}>
            No, thank you
          </CustomLink>
          <PrimaryButton
            fullWidth
            variant="contained"
            color="primary"
            disabled={isAccepting || !isTCAccepted || !isDPAccepted || isRejecting}
            disableWhenOffline={true}
            data-testid={DATA_TEST_ID.ACCEPT_BUTTON}
            onClick={handleAcceptedDPA}
          >
            Sure, I am ready
          </PrimaryButton>
        </Box>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}
          sx={{
            marginTop: theme.fixedSpacing(theme.tabiyaSpacing.xl),
          }}
          data-testid={DATA_TEST_ID.SUPPORT_CONTAINER}
        >
          <Typography typography="body1">With support from</Typography>
          <img
            src={`${process.env.PUBLIC_URL}/google-logo.svg`}
            alt="Google.org Logo"
            height={6 * theme.tabiyaSpacing.xl} // xl wasn't quite big enough, we're going for ~24px
            data-testid={DATA_TEST_ID.GOOGLE_LOGO}
          />
        </Box>
      </Box>
      <ConfirmModalDialog
        isOpen={showRejectModal}
        title="Are you sure?"
        content={
          <Box
            display="flex"
            flexDirection="column"
            gap={isSmallMobile ? theme.tabiyaSpacing.xl : theme.tabiyaSpacing.md}
          >
            <Typography>
              We're sorry that you choose not to agree to the {termsAndConditionsLabel} and the {privacyPolicyLabel}.
              You will not be able to proceed and will be <HighlightedSpan>logged out.</HighlightedSpan>
            </Typography>
            <Typography>Are you sure you want to exit?</Typography>
          </Box>
        }
        onCancel={handleRejected}
        onConfirm={() => {
          setShowRejectModal(false);
        }}
        onDismiss={() => {
          setShowRejectModal(false);
        }}
        cancelButtonText="Yes, exit"
        confirmButtonText="I want to stay"
      />
    </Container>
  );
};

export default Consent;
