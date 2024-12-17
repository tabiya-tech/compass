import React, { useCallback, useState } from "react";
import { Box, Container, Divider, styled, TextField, Typography, useTheme } from "@mui/material";
import { NavLink as RouterNavLink, useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import SocialAuth from "src/auth/components/SocialAuth/SocialAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import RegisterWithEmailForm from "src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { writeFirebaseErrorToLog } from "src/error/FirebaseError/logger";
import FirebaseEmailAuthService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import BugReportButton from "src/feedback/bugReport/bugReportButton/BugReportButton";
import FirebaseSocialAuthenticationService from "src/auth/services/FirebaseAuthenticationService/socialAuth/FirebaseSocialAuthentication.service";

const uniqueId = "ab02918f-d559-47ba-9662-ea6b3a3606d0";

const StyledNavLink = styled(RouterNavLink)(({ theme }) => ({
  color: theme.palette.text.textAccent,
  fontStyle: "italic",
  textDecoration: "none",
  "&:hover": {
    textDecoration: "underline",
  },
}));

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

  // a state to determine if the user is currently registering with email
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const handleError = useCallback(
    async (error: Error) => {
      let errorMessage;
      if (error instanceof ServiceError) {
        writeServiceErrorToLog(error, console.error);
        errorMessage = getUserFriendlyErrorMessage(error);
      } else if (error instanceof FirebaseError) {
        writeFirebaseErrorToLog(error, console.warn);
        errorMessage = getUserFriendlyFirebaseErrorMessage(error);
      } else {
        console.error(error);
        errorMessage = error.message;
      }
      enqueueSnackbar(`Registration Failed: ${errorMessage}`, { variant: "error" });
    },
    [enqueueSnackbar]
  );

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
      const prefs = userPreferencesStateService.getUserPreferences();
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
   * @param username
   * @param email
   * @param password
   */
  const handleRegister = useCallback(
    async (username: string, email: string, password: string) => {
      setIsLoading(true);
      try {
        const firebaseEmailAuthServiceInstance = FirebaseEmailAuthService.getInstance();
        await firebaseEmailAuthServiceInstance.register(email, password, username, registrationCode);
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
    [navigate, enqueueSnackbar, setIsLoading, registrationCode, handleError]
  );

  /**
   * A callback function for the social auth component to set the loading state
   */
  const notifyOnSocialLoading = useCallback((socialAuthLoading: boolean) => {
    setIsLoading(socialAuthLoading);
  }, []);

  return (
    <>
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
          height={"80%"}
          width={"100%"}
        >
          <AuthHeader title={"Welcome to Compass!"} subtitle={"We need some information to get started"} />
          <Typography variant="subtitle2">Enter your registration code to sign up</Typography>
          <TextField
            fullWidth
            label="Registration code"
            variant="outlined"
            required
            value={registrationCode}
            onChange={(e) => handleRegistrationCodeChanged(e)}
            inputProps={{ "data-testid": DATA_TEST_ID.REGISTRATION_CODE_INPUT }}
          />
          <Divider textAlign="center" style={{ width: "100%" }}>
            <Typography variant="subtitle2" padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
              and then continue with
            </Typography>
          </Divider>
          <RegisterWithEmailForm
            disabled={!registrationCode}
            notifyOnRegister={handleRegister}
            isRegistering={isLoading}
          />
          <SocialAuth
            postLoginHandler={handlePostLogin}
            isLoading={isLoading}
            disabled={!registrationCode}
            label={"Sign up with Google"}
            notifyOnLoading={notifyOnSocialLoading}
            registrationCode={registrationCode}
          />
          <Typography variant="body2" data-testid={DATA_TEST_ID.LOGIN_LINK}>
            Already have an account?{" "}
            <StyledNavLink
              to={routerPaths.LOGIN}
              style={{
                color: theme.palette.text.textAccent,
                fontStyle: "italic",
              }}
            >
              Login
            </StyledNavLink>
          </Typography>
        </Box>
      </Container>
      <BugReportButton bottomAlign={true} />
      <Backdrop isShown={isLoading} message="Registering you..." />
    </>
  );
};

export default Register;
