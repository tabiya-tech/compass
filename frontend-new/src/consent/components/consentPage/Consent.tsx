import React, { useCallback, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
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
import AuthPageShell from "src/auth/components/AuthPageShell/AuthPageShell";
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
import { getDarkLogoUrl } from "src/envService";

const uniqueId = "1dee3ba4-1853-40c6-aaad-eeeb0e94788d";

export const HighlightedSpan = styled("span")(({ theme }) => ({
  backgroundColor: theme.palette.common.cream,
  padding: "0 0.2em",
  borderRadius: "0.2em",
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
  const { t } = useTranslation();
  const logoSrc = getDarkLogoUrl() || `${process.env.PUBLIC_URL}/njila-logo-dark.svg`;
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
        console.error("Failed to send device specification metrics:", error);
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
          console.error("Failed to send user location metrics:", err);
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
        console.warn("User preferences could not be persisted: user not found. Redirecting to landing page.");
        enqueueSnackbar(t("consent.components.consentPage.snackbarUserNotFound"), { variant: "error" });
        navigate(routerPaths.LOGIN);
        return;
      }

      const newUserPreferenceSpecs: UpdateUserPreferencesSpec = {
        user_id: user.id,
        language: Language.en,
        accepted_tc: new Date(),
      };
      setIsAccepting(true);
      const prefs = await UserPreferencesService.getInstance().updateUserPreferences(newUserPreferenceSpecs);
      console.info("User preferences saved successfully and consent recorded.");

      UserPreferencesStateService.getInstance().setUserPreferences({
        ...prefs,
        sensitive_personal_data_requirement: userPreferences?.sensitive_personal_data_requirement!,
      });

      if (!isSensitiveDataValid(userPreferences!)) {
        console.info("User preferences incomplete. Redirecting to sensitive data page.");
        navigate(routerPaths.SENSITIVE_DATA, { replace: true });
      } else {
        navigate(routerPaths.ROOT, { replace: true });
      }

      sendMetricsEvent(prefs.user_id);

      enqueueSnackbar(t("consent.components.consentPage.snackbarAgreementAccepted"), { variant: "success" });
    } catch (e: unknown) {
      console.error(new AuthenticationError("Failed to update user preferences", e));
      if (e instanceof RestAPIError) {
        enqueueSnackbar(getUserFriendlyErrorMessage(e), { variant: "error" });
      } else {
        enqueueSnackbar(
          `${t("consent.components.consentPage.snackbarFailedUpdatePreferences")}: ${(e as Error).message}`,
          { variant: "error" }
        );
      }
    } finally {
      setIsAccepting(false);
    }
  }, [enqueueSnackbar, navigate, userPreferences, t]);

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
      console.info("User rejected consent. Logging out user.");

      navigate(routerPaths.LOGIN, { replace: true });
      enqueueSnackbar(t("consent.components.consentPage.snackbarLoggedOutSuccess"), { variant: "success" });
    } catch (e) {
      console.error(new AuthenticationError("Failed to log out", e));
      enqueueSnackbar(t("consent.components.consentPage.snackbarLoggedOutFailure"), { variant: "error" });
    } finally {
      setIsRejecting(false);
    }
  }, [enqueueSnackbar, navigate, t]);

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

  const termsAndConditionsLabel = t("consent.components.consentPage.termsAndConditions");
  const privacyPolicyLabel = t("consent.components.consentPage.privacyPolicy");

  const openLegalDocumentInNewTab = (routePath: string) => {
    window.open(`${window.location.origin}/#${routePath}`, "_blank", "noopener,noreferrer");
  };

  const whiteBandContent = (
    <Container
      maxWidth="sm"
      disableGutters
      sx={{
        pt: { xs: theme.fixedSpacing(theme.tabiyaSpacing.xl), md: theme.fixedSpacing(theme.tabiyaSpacing.sm) },
        pb: theme.fixedSpacing(theme.tabiyaSpacing.xl),
      }}
      data-testid={DATA_TEST_ID.CONSENT_CONTAINER}
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
        <Box display="flex" flexDirection="column" alignItems="left" justifyContent={"space-evenly"}>
          <Typography variant="h1" color="primary.main" gutterBottom data-testid={DATA_TEST_ID.TITLE}>
            {t("consent.components.consentPage.beforeWeBeginTitle")}
          </Typography>
          <Box
            display={"flex"}
            flexDirection={"column"}
            textAlign={"start"}
            width={"100%"}
            gap={theme.fixedSpacing(theme.tabiyaSpacing.lg)}
          >
            <Typography variant="body2" gutterBottom data-testid={DATA_TEST_ID.AGREEMENT_BODY}>
              {t("consent.components.consentPage.introPart1")}
              <br />
              <br />
              <HighlightedSpan>{t("consent.components.consentPage.introHighlightResponsibly")}</HighlightedSpan>
              <br />
              <br />
              {t("consent.components.consentPage.introPart2")}
              <br />
              <br />
              {t("consent.components.consentPage.introPart3")}
              <br />
              <br />
              {t("consent.components.consentPage.introPart4")}
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
                sx={{ alignItems: "center" }}
                label={
                  <Typography variant="body2" data-testid={DATA_TEST_ID.ACCEPT_TERMS_AND_CONDITIONS_TEXT}>
                    <Trans
                      i18nKey="consent.components.consentPage.checkboxTermsAndConditions"
                      values={{ terms_and_conditions: termsAndConditionsLabel }}
                      components={[<CustomLink onClick={() => openLegalDocumentInNewTab(routerPaths.TERMS_OF_USE)} />]}
                    />
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
                sx={{ alignItems: "center" }}
                label={
                  <Typography variant="body2" data-testid={DATA_TEST_ID.ACCEPT_CHECKBOX_TEXT}>
                    <Trans
                      i18nKey="consent.components.consentPage.checkboxPrivacyPolicy"
                      values={{ privacy_policy: privacyPolicyLabel }}
                      components={[
                        <CustomLink onClick={() => openLegalDocumentInNewTab(routerPaths.PRIVACY_POLICY)} />,
                      ]}
                    />
                  </Typography>
                }
              />
            </Box>
            <Typography>
              {t("consent.components.consentPage.areYouReady")}
              <br />
            </Typography>
          </Box>
          <Box
            sx={{
              width: "100%",
              display: "flex",
              flexDirection: { xs: "column-reverse", sm: "row" },
              justifyContent: { xs: "center", sm: "space-between" },
              alignItems: "center",
              marginTop: theme.fixedSpacing(theme.tabiyaSpacing.md),
              gap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
            }}
          >
            <CustomLink
              data-testid={DATA_TEST_ID.REJECT_BUTTON}
              onClick={() => setShowRejectModal(true)}
              sx={{ alignSelf: { xs: "center", sm: "auto" }, textAlign: "center" }}
            >
              {t("common.buttons.noThankYou")}
            </CustomLink>
            <PrimaryButton
              variant="contained"
              showCircle
              color="primary"
              disabled={isAccepting || !isTCAccepted || !isDPAccepted || isRejecting}
              disableWhenOffline={true}
              data-testid={DATA_TEST_ID.ACCEPT_BUTTON}
              onClick={handleAcceptedDPA}
            >
              {t("consent.components.consentPage.acceptButton")}
            </PrimaryButton>
          </Box>
        </Box>
      </Box>
    </Container>
  );

  return (
    <>
      <AuthPageShell
        logoUrl={logoSrc}
        whiteBandContent={whiteBandContent}
        whiteBandBackgroundColor={theme.palette.containerBackground.main}
      />
      <Backdrop isShown={isLoggingOut} message={t("common.backdrop.loggingYouOut")} />
      <ConfirmModalDialog
        isOpen={showRejectModal}
        title={t("common.modal.areYouSure")}
        content={
          <Box
            display="flex"
            flexDirection="column"
            gap={isSmallMobile ? theme.tabiyaSpacing.xl : theme.tabiyaSpacing.md}
          >
            <Typography>
              {t("consent.components.consentPage.modalApology", {
                terms_and_conditions: termsAndConditionsLabel,
                privacy_policy: privacyPolicyLabel,
              })}{" "}
              {t("consent.components.consentPage.modalCannotProceed")}{" "}
              <HighlightedSpan>{t("consent.components.consentPage.modalLoggedOutHighlight")}</HighlightedSpan>
            </Typography>
            <Typography>{t("common.modal.areYouSureYouWantToExit")}</Typography>
          </Box>
        }
        onCancel={handleRejected}
        onConfirm={() => {
          setShowRejectModal(false);
        }}
        onDismiss={() => {
          setShowRejectModal(false);
        }}
        cancelButtonText={t("consent.components.consentPage.modalYesExit")}
        confirmButtonText={t("common.buttons.iWantToStay")}
      />
    </>
  );
};

export default Consent;
