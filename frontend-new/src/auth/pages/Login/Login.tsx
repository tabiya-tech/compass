import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Container, Divider, Typography, useTheme } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import SocialAuth from "src/auth/components/SocialAuth/SocialAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { getUserFriendlyErrorMessage, RestAPIError } from "src/error/restAPIError/RestAPIError";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import LoginWithEmailForm from "src/auth/pages/Login/components/LoginWithEmailForm/LoginWithEmailForm";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import LoginWithInviteCodeForm from "./components/LoginWithInviteCodeForm/LoginWithInviteCodeForm";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import FirebaseEmailAuthService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import BugReportButton from "src/feedback/bugReport/bugReportButton/BugReportButton";
import FirebaseInvitationCodeAuthenticationService from "src/auth/services/FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService";
import { AuthenticationError } from "src/error/commonErrors";
import ResendVerificationEmail from "src/auth/components/resendVerificationEmail/ResendVerificationEmail";
import RequestInvitationCode from "src/auth/components/requestInvitationCode/RequestInvitationCode";
import { InvitationType } from "src/auth/services/invitationsService/invitations.types";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { INVITATIONS_PARAM_NAME } from "src/auth/auth.types";
import MetricsService from "src/metrics/metricsService";
import { DeviceSpecificationEvent, EventType, UserLocationEvent } from "src/metrics/types";
import { browserName, deviceType, osName, browserVersion } from "react-device-detect";
import { getCoordinates } from "src/metrics/utils/getUserLocation";
import { getApplicationLoginCode, getApplicationRegistrationCode } from "src/envService";

const uniqueId = "7ce9ba1f-bde0-48e2-88df-e4f697945cc4";

export const DATA_TEST_ID = {
  LOGIN_CONTAINER: `login-container-${uniqueId}`,
  SUBTITLE: `login-subtitle-${uniqueId}`,
  FORM: `login-form-${uniqueId}`,
  EMAIL_INPUT: `login-email-input-${uniqueId}`,
  PASSWORD_INPUT: `login-password-input-${uniqueId}`,
  LOGIN_BUTTON: `login-button-${uniqueId}`,
  LOGIN_BUTTON_CIRCULAR_PROGRESS: `login-button-circular-progress-${uniqueId}`,
  FORGOT_PASSWORD_LINK: `login-forgot-password-link-${uniqueId}`,
  LOGIN_USING: `login-using-${uniqueId}`,
  FIREBASE_AUTH_CONTAINER: `firebase-auth-container-${uniqueId}`,
  LOGIN_LINK: `login-login-link-${uniqueId}`,
  LANGUAGE_SELECTOR: `login-language-selector-${uniqueId}`,
  REQUEST_LOGIN_CODE_LINK: `login-request-login-code-link-${uniqueId}`,
  START_NEW_CONVERSATION_BUTTON: `login-start-new-conversation-button-${uniqueId}`,
};

enum ActiveForm {
  NONE = "NONE",
  EMAIL = "EMAIL",
  INVITE_CODE = "INVITE_CODE",
}

const Login: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();

  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [activeLoginForm, setActiveLoginForm] = useState(ActiveForm.NONE);

  // a state to keep track of whether the login process is loading
  const [isLoading, setIsLoading] = useState(false);

  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const [showResendVerification, setShowResendVerification] = useState(false);
  const [lastAttemptedEmail, setLastAttemptedEmail] = useState("");
  const [lastAttemptedPassword, setLastAttemptedPassword] = useState("");

  const handleError = useCallback(
    async (error: Error) => {
      let errorMessage;
      if (error instanceof RestAPIError) {
        errorMessage = getUserFriendlyErrorMessage(error);
        console.error(error);
        setShowResendVerification(false);
      } else if (error instanceof FirebaseError) {
        errorMessage = getUserFriendlyFirebaseErrorMessage(error);
        if (error.errorCode === FirebaseErrorCodes.INVALID_INVITATION_CODE) {
          // we want to log errors about invalid invitation codes as errors
          // so that we can track which invitation codes are failing and why
          console.error(error);
        } else {
          console.warn(error);
        }
        // Show resend verification option if the error is due to unverified email
        if (error.errorCode === FirebaseErrorCodes.EMAIL_NOT_VERIFIED) {
          setShowResendVerification(true);
        } else {
          setShowResendVerification(false);
        }
      } else {
        errorMessage = error.message;
        console.error(error);
        setShowResendVerification(false);
      }
      enqueueSnackbar(`Failed to login: ${errorMessage}`, { variant: "error" });

      // if something goes wrong, log the user out
      const firebaseEmailAuthServiceInstance = FirebaseEmailAuthService.getInstance();
      await firebaseEmailAuthServiceInstance.logout();
    },
    [enqueueSnackbar]
  );

  /* ------------------
   * Callbacks to handle changes in the form fields
   */
  const handleEmailChanged = (email: string) => {
    setActiveLoginForm(ActiveForm.EMAIL);
    setEmail(email);
  };
  const handlePasswordChanged = (password: string) => {
    setActiveLoginForm(ActiveForm.EMAIL);
    setPassword(password);
  };
  const handleInviteCodeChanged = (code: string) => {
    setActiveLoginForm(ActiveForm.INVITE_CODE);
    setInviteCode(code);
  };

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

  const applicationLoginCode = useMemo(() => {
    return getApplicationLoginCode();
  }, []);

  const applicationRegistrationCode = useMemo(() => {
    return getApplicationRegistrationCode();
  }, []);

  /* ------------------
   * Callbacks to handle successful logins
   */
  const handlePostLogin = useCallback(async () => {
    try {
      const prefs = UserPreferencesStateService.getInstance().getUserPreferences();
      // once the user is logged in, we need to get their preferences from the state and
      // decide, based on the preferences, where to navigate the user
      if (!prefs?.accepted_tc || isNaN(prefs?.accepted_tc.getTime())) {
        navigate(routerPaths.CONSENT, { replace: true });
      } else {
        // if the user has preferences, we can record some metrics about their device and location
        // if not the user will be redirected to the consent page to set their preferences
        // and once they accept the terms and conditions, the metrics will be recorded
        sendMetricsEvent(prefs.user_id);
        // and then navigate the user to the root page
        navigate(routerPaths.ROOT, { replace: true });
        enqueueSnackbar("Welcome back!", { variant: "success" });
      }
    } catch (error: unknown) {
      console.error(new AuthenticationError("An error occurred while trying to get your preferences", error));
      let errorMessage;
      if (error instanceof RestAPIError) {
        errorMessage = getUserFriendlyErrorMessage(error);
      } else {
        errorMessage = (error as Error).message;
      }
      enqueueSnackbar(`An error occurred while trying to get your preferences: ${errorMessage}`, {
        variant: "error",
      });
    }
  }, [navigate, enqueueSnackbar]);

  /* ------------------
   * Actual login handlers
   */
  /**
   * Handle the login form submission
   * @param email
   * @param password
   */
  const handleLoginWithEmail = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const firebaseEmailAuthServiceInstance = FirebaseEmailAuthService.getInstance();
        await firebaseEmailAuthServiceInstance.login(email, password);
        await handlePostLogin();
      } catch (error) {
        // Store the credentials before handling the error
        setLastAttemptedEmail(email);
        setLastAttemptedPassword(password);
        // Now handle the error
        await handleError(error as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, handlePostLogin]
  );

  /**
   * Handle the login with an invitation code
   * @param code
   */
  const handleLoginWithInvitationCode = useCallback(
    async (code: string) => {
      try {
        setIsLoading(true);
        const firebaseInvitationAuthServiceInstance = FirebaseInvitationCodeAuthenticationService.getInstance();
        await firebaseInvitationAuthServiceInstance.login(code);
        enqueueSnackbar("Invitation code is valid", { variant: "success" });
        await handlePostLogin();
      } catch (error) {
        await handleError(error as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [enqueueSnackbar, handleError, handlePostLogin]
  );

  /**
   * callback functions for the social auth component to set the loading state
   */
  const notifyOnSocialLoading = useCallback((socialAuthLoading: boolean) => {
    setIsLoading(socialAuthLoading);
  }, []);

  // depending on which form is active, handle submit button
  /**
   * The submit button could be used to login with email/password or with an invitation code
   * This function handles the submission of the form, and decides which method to use based on the active form
   * @param event
   */
  const handleLoginSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (activeLoginForm === ActiveForm.INVITE_CODE) {
        await handleLoginWithInvitationCode(inviteCode);
      } else if (activeLoginForm === ActiveForm.EMAIL && email && password) {
        await handleLoginWithEmail(email, password);
      } else {
        enqueueSnackbar("Please fill in the email and password fields", { variant: "error" });
      }
    },
    [email, handleLoginWithInvitationCode, handleLoginWithEmail, activeLoginForm, inviteCode, password, enqueueSnackbar]
  );

  const handleStartNewConversation = useCallback(() => {
    handleLoginWithInvitationCode(applicationLoginCode).then(() => {});
  }, [handleLoginWithInvitationCode, applicationLoginCode]);

  /* ------------------
   * side effects, like checking the invite code in the URL
   */

  /**
   * Reset the form fields when the active form changes
   */
  useEffect(() => {
    if (activeLoginForm === ActiveForm.EMAIL) {
      setInviteCode("");
    } else if (activeLoginForm === ActiveForm.INVITE_CODE) {
      setEmail("");
      setPassword("");
    }
  }, [activeLoginForm]);

  /**
   * Check if the user was invited with an invitation code in the URL
   */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const inviteCodeParam = params.get(INVITATIONS_PARAM_NAME);
    if (inviteCodeParam) {
      handleLoginWithInvitationCode(inviteCodeParam).then(() =>
        console.info("Invitation code login successful: " + inviteCodeParam)
      );
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
  }, [handleLoginWithInvitationCode, location, navigate]);

  // Reset resend verification state when email or password changes
  useEffect(() => {
    setShowResendVerification(false);
  }, [email, password]);

  /* ------------------
   * aggregated states for loading and disabling ui
   */
  // login button is disabled when login is loading, or when there is no active Form, or the fields for the active form are not filled in
  const isLoginButtonDisabled =
    isLoading || activeLoginForm === ActiveForm.NONE || ((!email || !password) && !inviteCode);

  const invitationCodeAndEmailFormDividerText = useMemo(() => {
    if (applicationLoginCode) {
      return "Or login to your account to continue";
    } else {
      return "or";
    }
  }, [applicationLoginCode]);

  return (
    <Container
      maxWidth="xs"
      sx={{ height: "100%", padding: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}
      data-testid={DATA_TEST_ID.LOGIN_CONTAINER}
    >
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent={"space-evenly"}
        gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
        width={"100%"}
      >
        <AuthHeader title={"Welcome to Compass!"} />
        <Box
          component="form"
          onSubmit={handleLoginSubmit}
          data-testid={DATA_TEST_ID.FORM}
          display={"flex"}
          flexDirection={"column"}
          textAlign={"center"}
          width={"100%"}
          gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
        >
          {applicationLoginCode ? (
            <PrimaryButton
              disabled={isLoading}
              disableWhenOffline={true}
              onClick={handleStartNewConversation}
              data-testid={DATA_TEST_ID.START_NEW_CONVERSATION_BUTTON}
            >
              Continue as Guest
            </PrimaryButton>
          ) : (
            <React.Fragment>
              <Typography variant="body2">Login to your account to continue</Typography>
              <Typography variant="subtitle2" data-testid={DATA_TEST_ID.SUBTITLE}>
                Login using
              </Typography>
              <LoginWithInviteCodeForm
                inviteCode={inviteCode}
                notifyOnInviteCodeChanged={handleInviteCodeChanged}
                isDisabled={isLoading}
              />
            </React.Fragment>
          )}
          <Divider textAlign="center" style={{ width: "100%" }}>
            <Typography
              variant="subtitle2"
              padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
              data-testid={DATA_TEST_ID.SUBTITLE}
            >
              {invitationCodeAndEmailFormDividerText}
            </Typography>
          </Divider>

          <LoginWithEmailForm
            email={email}
            password={password}
            notifyOnEmailChanged={handleEmailChanged}
            notifyOnPasswordChanged={handlePasswordChanged}
            isDisabled={isLoading}
          />
          {showResendVerification && (
            <ResendVerificationEmail email={lastAttemptedEmail} password={lastAttemptedPassword} />
          )}
          <PrimaryButton
            fullWidth
            variant="contained"
            color="primary"
            style={{ marginTop: 8 }}
            type="submit"
            disabled={isLoginButtonDisabled}
            disableWhenOffline={true}
            data-testid={DATA_TEST_ID.LOGIN_BUTTON}
          >
            {isLoading ? (
              <CircularProgress
                color={"secondary"}
                data-testid={DATA_TEST_ID.LOGIN_BUTTON_CIRCULAR_PROGRESS}
                aria-label={"Logging in"}
                size={16}
                sx={{ marginTop: theme.tabiyaSpacing.sm, marginBottom: theme.tabiyaSpacing.sm }}
              />
            ) : (
              "Login"
            )}
          </PrimaryButton>
        </Box>
        <SocialAuth
          disabled={false}
          postLoginHandler={handlePostLogin}
          isLoading={isLoading}
          notifyOnLoading={notifyOnSocialLoading}
          registrationCode={applicationRegistrationCode}
        />
        <Typography variant="caption" data-testid={DATA_TEST_ID.LOGIN_LINK}>
          Don't have an account? <CustomLink onClick={() => navigate(routerPaths.REGISTER)}>Register</CustomLink>
        </Typography>
        {!applicationLoginCode && <RequestInvitationCode invitationCodeType={InvitationType.LOGIN} />}
      </Box>
      <BugReportButton bottomAlign={true} />
      <Backdrop isShown={isLoading} message={"Logging you in..."} />
    </Container>
  );
};

export default Login;
