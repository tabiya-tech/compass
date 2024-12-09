import React, { useCallback, useEffect, useState } from "react";
import { Box, CircularProgress, Container, Divider, styled, Typography, useTheme } from "@mui/material";
import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import SocialAuth from "src/auth/components/SocialAuth/SocialAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import LoginWithEmailForm from "src/auth/pages/Login/components/LoginWithEmailForm/LoginWithEmailForm";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import LoginWithInviteCodeForm from "./components/LoginWithInviteCodeForm/LoginWithInviteCodeForm";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { writeFirebaseErrorToLog } from "src/error/FirebaseError/logger";
import FirebaseEmailAuthService from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import BugReportButton from "src/feedback/bugReportButton/BugReportButton";
import FirebaseInvitationCodeAuthenticationService from "src/auth/services/FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService";
import { AuthenticationError } from "../../../error/commonErrors";

export const INVITATIONS_PARAM_NAME = "invite-code";

const uniqueId = "7ce9ba1f-bde0-48e2-88df-e4f697945cc4";

const StyledNavLink = styled(RouterNavLink)(({ theme }) => ({
  color: theme.palette.text.textAccent,
  fontStyle: "italic",
  textDecoration: "none",
  "&:hover": {
    textDecoration: "underline",
  },
}));

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
};

enum ActiveForm {
  NONE = "NONE",
  EMAIL = "EMAIL",
  INVITE_CODE = "INVITE_CODE",
}

const Login: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const inviteCodeParam = params.get(INVITATIONS_PARAM_NAME);

  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [activeLoginForm, setActiveLoginForm] = useState(ActiveForm.NONE);

  // a state to keep track of whether the login process is loading
  const [isLoading, setIsLoading] = useState(false);

  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const handleError = useCallback(
    async (error: Error) => {
      // if something goes wrong, log the user out
      const firebaseEmailAuthServiceInstance = FirebaseEmailAuthService.getInstance();
      await firebaseEmailAuthServiceInstance.logout();

      let errorMessage;
      if (error instanceof ServiceError) {
        errorMessage = getUserFriendlyErrorMessage(error);
        writeServiceErrorToLog(error, console.error);
      } else if (error instanceof FirebaseError) {
        errorMessage = getUserFriendlyFirebaseErrorMessage(error);
        writeFirebaseErrorToLog(error, console.warn);
      } else {
        errorMessage = error.message;
        console.error(error);
      }
      enqueueSnackbar(`Failed to login: ${errorMessage}`, { variant: "error" });
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

  /* ------------------
   * Callbacks to handle successful logins
   */
  const handlePostLogin = useCallback(async () => {
    try {
      const prefs = userPreferencesStateService.getUserPreferences();
      // once the user is logged in, we need to get their preferences from the state and
      // decide, based on the preferences, where to navigate the user
      if (!prefs?.accepted_tc || isNaN(prefs?.accepted_tc.getTime())) {
        navigate(routerPaths.DPA, { replace: true });
      } else {
        navigate(routerPaths.ROOT, { replace: true });
        enqueueSnackbar("Welcome back!", { variant: "success" });
      }
    } catch (error) {
      let errorMessage;
      if (error instanceof ServiceError) {
        writeServiceErrorToLog(error, console.error);
        errorMessage = getUserFriendlyErrorMessage(error);
      } else {
        errorMessage = (error as Error).message;
        console.error(new AuthenticationError("An error occurred while trying to get your preferences", error as Error));
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
        const firebaseEmailAuthServiceInstance = await FirebaseEmailAuthService.getInstance();
        await firebaseEmailAuthServiceInstance.login(email, password);
        await handlePostLogin();
      } catch (error) {
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
    if (inviteCodeParam) {
      handleLoginWithInvitationCode(inviteCodeParam);
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
  }, [inviteCodeParam, handleLoginWithInvitationCode, location, navigate]);

  /* ------------------
   * aggregated states for loading and disabling ui
   */
  // login button is disabled when login is loading, or when there is no active Form, or the fields for the active form are not filled in
  const isLoginButtonDisabled =
    isLoading || activeLoginForm === ActiveForm.NONE || ((!email || !password) && !inviteCode);

  return (
    <>
      <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.LOGIN_CONTAINER}>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent={"space-evenly"} height={"80%"}>
          <AuthHeader title={"Welcome to Compass!"} subtitle={"Login to your account to continue"} />
          <Box
            component="form"
            onSubmit={handleLoginSubmit}
            data-testid={DATA_TEST_ID.FORM}
            display={"flex"}
            flexDirection={"column"}
            padding={theme.tabiyaSpacing.xs}
            textAlign={"center"}
            width={"100%"}
            gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
          >
            <Typography variant="subtitle2" data-testid={DATA_TEST_ID.SUBTITLE}>
              Login using
            </Typography>
            <LoginWithInviteCodeForm
              inviteCode={inviteCode}
              notifyOnInviteCodeChanged={handleInviteCodeChanged}
              isDisabled={isLoading}
            />
            <Divider textAlign="center" style={{ width: "100%" }}>
              <Typography
                variant="subtitle2"
                padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
                data-testid={DATA_TEST_ID.SUBTITLE}
              >
                Or
              </Typography>
            </Divider>

            <LoginWithEmailForm
              email={email}
              password={password}
              notifyOnEmailChanged={handleEmailChanged}
              notifyOnPasswordChanged={handlePasswordChanged}
              isDisabled={isLoading}
              notifyOnFocused={() => {}}
            />
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
          />
          <Typography variant="body2" mt={2} data-testid={DATA_TEST_ID.LOGIN_LINK}>
            Don't have an account?{" "}
            <StyledNavLink
              to={routerPaths.REGISTER}
              style={{
                color: theme.palette.text.textAccent,
                fontStyle: "italic",
              }}
            >
              Register
            </StyledNavLink>
          </Typography>
        </Box>
        <BugReportButton bottomAlign={true} />
      </Container>
      <Backdrop isShown={isLoading} message={"Logging you in..."} />
    </>
  );
};

export default Login;
