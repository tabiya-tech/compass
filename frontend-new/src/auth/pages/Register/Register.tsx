import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Container, Divider, TextField, Typography, useTheme } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import SocialAuth from "src/auth/components/SocialAuth/SocialAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import RegisterWithEmailForm from "src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import FirebaseEmailAuthService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import { getUserFriendlyErrorMessage, RestAPIError } from "src/error/restAPIError/RestAPIError";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import BugReportButton from "src/feedback/bugReport/bugReportButton/BugReportButton";
import FirebaseSocialAuthenticationService from "src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service";
import RequestInvitationCode from "src/auth/components/requestInvitationCode/RequestInvitationCode";
import { InvitationType } from "src/auth/services/invitationsService/invitations.types";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import { INVITATIONS_PARAM_NAME } from "src/auth/auth.types";
import { getApplicationRegistrationCode, getSocialAuthDisabled } from "src/envService";

const uniqueId = "ab02918f-d559-47ba-9662-ea6b3a3606d0";

export const DATA_TEST_ID = {
  REGISTRATION_CODE_INPUT: `register-registration-code-input-${uniqueId}`,
  REGISTER_CONTAINER: `register-container-${uniqueId}`,
  LOGO: `register-logo-${uniqueId}`,
  TITLE: `register-title-${uniqueId}`,
  SUBTITLE: `register-subtitle-${uniqueId}`,
  FORM: `register-form-${uniqueId}`,
  USERNAME_INPUT: `register-username-input-${uniqueId}`,
  EMAIL_INPUT: `register-email-input-${uniqueId}`,
  PASSWORD_INPUT: `register-password-input-${uniqueId}`,
  REGISTER_BUTTON: `register-button-${uniqueId}`,
  REGISTER_BUTTON_CIRCULAR_PROGRESS: `register-button-circular-progress-${uniqueId}`,
  FORGOT_PASSWORD_LINK: `register-forgot-password-link-${uniqueId}`,
  REGISTER_USING: `register-using-${uniqueId}`,
  FIREBASE_AUTH_CONTAINER: `firebase-auth-container-${uniqueId}`,
  LOGIN_LINK: `register-login-link-${uniqueId}`,
  LANGUAGE_SELECTOR: `register-language-selector-${uniqueId}`,
};

const Register: React.FC = () => {
  const [registrationCode, setRegistrationCode] = useState<string>("");
  const theme = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Check for invitation code in URL params when component mounts
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const inviteCodeParam = params.get(INVITATIONS_PARAM_NAME);

    if (inviteCodeParam) {
      setRegistrationCode(inviteCodeParam);
      // Remove the invite code from the URL
      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.delete(INVITATIONS_PARAM_NAME);
      navigate(
        {
          pathname: location.pathname,
          search: newSearchParams.toString(),
        },
        { replace: true }
      );
    }
  }, [location, navigate]);

  // a state to determine if the user is currently registering with email
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { enqueueSnackbar } = useSnackbar();

  const handleError = useCallback(
    async (error: Error) => {
      let errorMessage;
      if (error instanceof RestAPIError) {
        console.error(error);
        errorMessage = getUserFriendlyErrorMessage(error);
      } else if (error instanceof FirebaseError) {
        errorMessage = getUserFriendlyFirebaseErrorMessage(error);
        if (error.errorCode === FirebaseErrorCodes.INVALID_REGISTRATION_CODE) {
          console.error(error);
        } else {
          console.warn(error);
        }
      } else {
        console.error(error);
        errorMessage = error.message;
      }
      enqueueSnackbar(`Registration Failed: ${errorMessage}`, { variant: "error" });
    },
    [enqueueSnackbar]
  );

  const applicationRegistrationCode = useMemo(() => {
    return getApplicationRegistrationCode();
  }, []);

  const socialAuthDisabled = useMemo(() => {
    return getSocialAuthDisabled().toLowerCase() === "true";
  }, []);

  /* -----------
   * callbacks to pass to the child components
   */
  const handleRegistrationCodeChanged = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setRegistrationCode(event.target.value);
  };

  /**
   * Handles what happens after social registration (same process as login)
   * @param user
   */
  const handlePostLogin = useCallback(async () => {
    try {
      setIsLoading(true);
      const prefs = UserPreferencesStateService.getInstance().getUserPreferences();
      if (!prefs?.accepted_tc || isNaN(prefs?.accepted_tc.getTime())) {
        navigate(routerPaths.CONSENT, { replace: true });
      } else {
        navigate(routerPaths.ROOT, { replace: true });
        enqueueSnackbar("Welcome back!", { variant: "success" });
      }
    } catch (error) {
      const firebaseSocialAuthServiceInstance = FirebaseSocialAuthenticationService.getInstance();
      await firebaseSocialAuthServiceInstance.logout(); // this does not throw an error, at least in the current implementation
      await handleError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [navigate, enqueueSnackbar, handleError]);

  /* ------------
   * Actual registration handlers
   */
  /**
   * Handle the register form submission
   * @param email
   * @param password
   */
  const handleRegister = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const firebaseEmailAuthServiceInstance = FirebaseEmailAuthService.getInstance();
        // if the instance has application registration code set, we should use that instead of the one entered by the user.
        const registrationCodeToUse = registrationCode || applicationRegistrationCode;
        // We're using the mail as the username for now, since we don't have any use case in the app for it
        await firebaseEmailAuthServiceInstance.register(email, password, email, registrationCodeToUse);
        enqueueSnackbar("Verification Email Sent!", { variant: "success" });
        // IMPORTANT NOTE: after the preferences are added, or fail to be added, we should log the user out immediately,
        // since if we don't do that, the user may be able to access the application without verifying their email
        // or accepting the dpa.
        await firebaseEmailAuthServiceInstance.logout();
        // navigate to the verify email page
        navigate(routerPaths.VERIFY_EMAIL, { replace: true });
      } catch (e) {
        await handleError(e as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, enqueueSnackbar, setIsLoading, registrationCode, handleError, applicationRegistrationCode]
  );

  /**
   * A callback function for the social auth component to set the loading state
   */
  const notifyOnSocialLoading = useCallback((socialAuthLoading: boolean) => {
    setIsLoading(socialAuthLoading);
  }, []);

  return (
    <Container
      maxWidth="xs"
      sx={{ height: "100%", padding: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}
      data-testid={DATA_TEST_ID.REGISTER_CONTAINER}
    >
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent={"space-evenly"}
        gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
        width={"100%"}
      >
        <AuthHeader
          title={t("welcome_to_compass")}
          subtitle={
            <Typography variant="body2" gutterBottom>
              {t("register_subtitle")}
            </Typography>
          }
        />
        {!applicationRegistrationCode && (
          <React.Fragment>
            <Typography variant="subtitle2">{t("enter_registration_code")}</Typography>
            <TextField
              fullWidth
              label={t("registration_code")}
              variant="outlined"
              required
              value={registrationCode}
              onChange={(e) => handleRegistrationCodeChanged(e)}
              inputProps={{ "data-testid": DATA_TEST_ID.REGISTRATION_CODE_INPUT }}
            />
          </React.Fragment>
        )}
        {!applicationRegistrationCode && (
          <Divider textAlign="center" style={{ width: "100%" }}>
            <Typography variant="subtitle2" padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
              {t("and_either_continue_with")}
            </Typography>
          </Divider>
        )}
        <RegisterWithEmailForm
          disabled={!registrationCode && !applicationRegistrationCode}
          notifyOnRegister={handleRegister}
          isRegistering={isLoading}
        />
        {!socialAuthDisabled && (
          <SocialAuth
            postLoginHandler={handlePostLogin}
            isLoading={isLoading}
            disabled={!registrationCode && !applicationRegistrationCode}
            label={t("register_with_google")}
            notifyOnLoading={notifyOnSocialLoading}
            registrationCode={registrationCode || applicationRegistrationCode}
          />
        )}
        <Typography variant="caption" data-testid={DATA_TEST_ID.LOGIN_LINK}>
          {t("already_have_account")} <CustomLink onClick={() => navigate(routerPaths.LOGIN)}>{t("login")}</CustomLink>
        </Typography>
        {!applicationRegistrationCode && <RequestInvitationCode invitationCodeType={InvitationType.REGISTER} />}
      </Box>
      <BugReportButton bottomAlign={true} />
      <Backdrop isShown={isLoading} message={t("registering_you")} />
    </Container>
  );
};

export default Register;
