import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { Box, Divider, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { getLoginCodeDisabled, getApplicationLoginCode, getRegistrationDisabled, getProductName } from "src/envService";
import FirebaseInvitationCodeAuthenticationService from "src/auth/services/FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { AuthenticationError } from "src/error/commonErrors";
import { RestAPIError, getUserFriendlyErrorMessage } from "src/error/restAPIError/RestAPIError";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { enqueueErrorSnackbarWithReference } from "src/theme/SnackbarProvider/enqueueErrorSnackbarWithReference";
import { useAuthPageContext } from "src/auth/components/AuthLayout/AuthPageContext";

const uniqueId = "e9c346bb-bcc6-4aaa-aaa9-d24d09274925";

export const DATA_TEST_ID = {
  LANDING_DIALOG: `landing-dialog-${uniqueId}`,
  LANDING_DIALOG_CONTENT: `landing-dialog-content-${uniqueId}`,
  LANDING_LOGIN_BUTTON: `landing-login-button-${uniqueId}`,
  LANDING_SIGNUP_BUTTON: `landing-signup-button-${uniqueId}`,
  LANDING_GUEST_BUTTON: `landing-continue-as-guest-button-${uniqueId}`,
  LANDING_DIVIDER: `landing-divider-${uniqueId}`,
};

const Landing: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { setPageLoading } = useAuthPageContext();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setPageLoading(isLoading, t("auth.pages.landing.loggingYouIn"));
  }, [isLoading, setPageLoading, t]);

  const appName = getProductName();

  const applicationLoginCode = useMemo(() => getApplicationLoginCode(), []);
  const loginCodeDisabled = useMemo(() => getLoginCodeDisabled().toLowerCase() === "true", []);
  const registrationDisabled = useMemo(() => getRegistrationDisabled().toLowerCase() === "true", []);

  const handleError = useCallback(
    async (error: Error) => {
      if (error instanceof RestAPIError) {
        console.error(error);
        enqueueSnackbar(getUserFriendlyErrorMessage(error), { variant: "error" });
      } else if (error instanceof FirebaseError) {
        console.warn(error);
        enqueueSnackbar(getUserFriendlyFirebaseErrorMessage(error), { variant: "error" });
      } else {
        console.error(error);
        enqueueErrorSnackbarWithReference(t("auth.errors.loginFailedGeneric"), { where: "Landing", error });
      }
    },
    [enqueueSnackbar, t]
  );

  const handlePostLogin = useCallback(async () => {
    try {
      const prefs = UserPreferencesStateService.getInstance().getUserPreferences();
      if (!prefs?.accepted_tc || isNaN(prefs?.accepted_tc.getTime())) {
        navigate(routerPaths.CONSENT, { replace: true });
      } else {
        navigate(routerPaths.ROOT, { replace: true });
        enqueueSnackbar(t("auth.pages.landing.welcome"), { variant: "success" });
      }
    } catch (error: unknown) {
      console.error(new AuthenticationError("An error occurred while trying to get your preferences", error));
      let errorMessage;
      if (error instanceof RestAPIError) {
        errorMessage = getUserFriendlyErrorMessage(error);
      } else {
        errorMessage = (error as Error).message;
      }
      enqueueSnackbar(t("auth.errors.preferencesFetchFailedWithMessage", { message: errorMessage }), {
        variant: "error",
      });
    }
  }, [navigate, enqueueSnackbar, t]);

  const handleContinueAsGuest = useCallback(async () => {
    try {
      setIsLoading(true);
      const firebaseInvitationAuthServiceInstance = FirebaseInvitationCodeAuthenticationService.getInstance();
      await firebaseInvitationAuthServiceInstance.login(applicationLoginCode);
      console.info("User logged in as guest.");
      enqueueSnackbar(t("auth.pages.landing.invitationCodeValid"), { variant: "success" });
      await handlePostLogin();
    } catch (error) {
      await handleError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [applicationLoginCode, handleError, handlePostLogin, enqueueSnackbar, t]);

  const showGuestOption = Boolean(applicationLoginCode && !loginCodeDisabled);

  const form = (
    <Box
      display="flex"
      flexDirection="column"
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
      sx={{ width: "100%", maxWidth: 360, mx: "auto" }}
    >
      <Box>
        <Typography variant="h3" gutterBottom sx={{ color: theme.palette.common.white }}>
          {t("auth.pages.landing.welcomeTitle", { appName })}
        </Typography>
        <Typography variant="h5" sx={{ color: theme.palette.common.white }}>
          {t("auth.pages.landing.subtitleBold")}
        </Typography>
      </Box>
      <PrimaryButton
        fullWidth
        disabled={isLoading}
        color="primary"
        onClick={() => navigate(routerPaths.LOGIN)}
        data-testid={DATA_TEST_ID.LANDING_LOGIN_BUTTON}
        sx={{
          backgroundColor: theme.palette.tertiary.light,
          color: theme.palette.primary.main,
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        {t("common.buttons.login")}
      </PrimaryButton>
      {!registrationDisabled && (
        <SecondaryButton
          fullWidth
          disabled={isLoading}
          color="primary"
          onClick={() => navigate(routerPaths.REGISTER)}
          data-testid={DATA_TEST_ID.LANDING_SIGNUP_BUTTON}
          sx={{
            borderColor: theme.palette.tertiary.light,
            color: theme.palette.tertiary.light,
            fontWeight: 700,
            textTransform: "uppercase",
            "&:hover:not(:disabled)": {
              backgroundColor: "transparent",
            },
          }}
        >
          {t("common.buttons.register")}
        </SecondaryButton>
      )}
      {showGuestOption && (
        <Box sx={{ width: "100%", textAlign: "center", mt: 1 }}>
          <Divider
            textAlign="center"
            sx={{
              width: "100%",
              my: 1,
              borderColor: alpha(theme.palette.common.white, 0.85),
            }}
            data-testid={DATA_TEST_ID.LANDING_DIVIDER}
          >
            <Typography
              variant="subtitle2"
              sx={{ px: 1, color: theme.palette.common.white }}
              padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
            >
              {t("auth.pages.landing.or")}
            </Typography>
          </Divider>
          <CustomLink
            onClick={handleContinueAsGuest}
            disabled={isLoading}
            disableWhenOffline={true}
            data-testid={DATA_TEST_ID.LANDING_GUEST_BUTTON}
            sx={{
              color: theme.palette.common.white,
              fontWeight: 700,
              "&:hover": { color: theme.palette.common.white, opacity: 0.7 },
            }}
          >
            {t("auth.pages.landing.continueAsGuest")}
          </CustomLink>
        </Box>
      )}
    </Box>
  );

  return (
    <Box data-testid={DATA_TEST_ID.LANDING_DIALOG} sx={{ minHeight: "100%" }}>
      <Box data-testid={DATA_TEST_ID.LANDING_DIALOG_CONTENT}>{form}</Box>
    </Box>
  );
};

export default Landing;
