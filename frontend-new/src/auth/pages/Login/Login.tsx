import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Container, Divider, styled, Typography, useTheme } from "@mui/material";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import SocialAuth from "src/auth/components/SocialAuth/SocialAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import LoginWithEmailForm from "src/auth/pages/Login/components/LoginWithEmailForm/LoginWithEmailForm";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import LoginWithInviteCodeForm from "./components/LoginWithInviteCodeForm/LoginWithInviteCodeForm";
import { validatePassword } from "src/auth/utils/validatePassword";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { writeFirebaseErrorToLog } from "src/error/FirebaseError/logger";
import { AuthContext, TabiyaUser } from "src/auth/AuthProvider";
import { emailAuthService } from "src/auth/services/emailAuth/EmailAuth.service";
import { anonymousAuthService } from "src/auth/services/anonymousAuth/AnonymousAuth.service";
import RegistrationCodeFormModal from "src/invitations/components/RegistrationCodeFormModal/RegistrationCodeFormModal";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { UserPreferencesContext } from "src/userPreferences/UserPreferencesProvider/UserPreferencesProvider";
import { InvitationStatus, InvitationType } from "../../../invitations/InvitationsService/invitations.types";

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

export interface LoginProps {
  postLoginHandler: (user: TabiyaUser) => void;
  isLoading: boolean;
}

enum ActiveForm {
  NONE = "NONE",
  EMAIL = "EMAIL",
  INVITE_CODE = "INVITE_CODE",
}

const Login: React.FC<Readonly<LoginProps>> = ({ postLoginHandler, isLoading }) => {
  const theme = useTheme();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const inviteCodeParam = params.get(INVITATIONS_PARAM_NAME);

  const renderCount = useRef(0);

  const [tempUser, setTempUser] = useState<TabiyaUser | null>(null);
  const [showRegistrationCodeForm, setShowRegistrationCodeForm] = useState(false);

  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>("");

  const [activeLoginForm, setActiveLoginForm] = useState(ActiveForm.NONE);

  const [isLoggingInWithEmail, setIsLoggingInWithEmail] = useState(false);
  const [isLoggingInAnonymously, setIsLoggingInAnonymously] = useState(false);

  const { isAuthenticationInProgress, updateUserByToken } = useContext(AuthContext);
  const { updateUserPreferences } = useContext(UserPreferencesContext);
  const { enqueueSnackbar } = useSnackbar();

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

  /**
   * A callback to handle what happens after the user has logged in with a social provider
   * This function is passed to the SocialAuth component, which calls it after a successful login
   * @param user
   */
  const successfulSocialLoginCallback = useCallback(async (user: TabiyaUser) => {
    //TODO: have a state here that tracks the loading state of the social login [COM-408]
    try {
      const prefs = await userPreferencesService.getUserPreferences(
        user.id,
      );
      // if the user is not found, it means that the user is new and needs to create user preferences
      // but first, we need to ask the user for a registration code
      if (prefs === null) {
        setTempUser(user);
        setShowRegistrationCodeForm(true);
        return;
      }
      updateUserPreferences(prefs);
      postLoginHandler(user);
    } catch (error) {
      let errorMessage;
      if (error instanceof ServiceError) {
        errorMessage = getUserFriendlyErrorMessage(error as Error);
      } else {
        console.error(error);
        errorMessage = (error as Error).message;
      }
      enqueueSnackbar(errorMessage, { variant: "error" });
    }
  }, [enqueueSnackbar, postLoginHandler, updateUserPreferences]);

  /**
   * A callback to create user preferences for a user, after they have entered a registration code
   * We pass this to the RegistrationCodeFormModal component to use after the user has entered a registration code
   * @param invitationCode
   */
  const createUserPreferencesCallback = useCallback(async (invitationCode: string) => {
    try {
      const prefs = await userPreferencesService.createUserPreferences(
        {
          user_id: tempUser?.id!,
          language: Language.en,
          invitation_code: invitationCode,
        }
      );
      updateUserPreferences(prefs);
      postLoginHandler(tempUser!);
    } catch (error) {
      let errorMessage;
      if (error instanceof ServiceError) {
        errorMessage = getUserFriendlyErrorMessage(error as Error);
        writeServiceErrorToLog(error, console.error);
      } else {
        console.error(error);
        errorMessage = (error as Error).message;
      }
      enqueueSnackbar(errorMessage, { variant: "error" });
      console.error("Error during login");
    }
  }, [enqueueSnackbar, postLoginHandler, tempUser, updateUserPreferences]);

  /* ------------------
  * Actual login handlers
  */
  /**
   * Handle the login form submission
   * @param email
   * @param password
   */
  const handleLoginWithEmail = useCallback(
    (email: string, password: string) => {
      const passwordValidationResult = validatePassword(password);
      setPasswordError(passwordValidationResult);

      if (passwordValidationResult === "" && email && password) {
        setIsLoggingInWithEmail(true);
        emailAuthService.handleLoginWithEmail(
          email,
          password,
          async (token) => {
            setIsLoggingInWithEmail(false);
            try {
              const _user = updateUserByToken(token);
              if (_user) {
                postLoginHandler(_user);
              }
            } catch (e) {
              let errorMessage;
              if (e instanceof FirebaseError) {
                errorMessage = getUserFriendlyFirebaseErrorMessage(e);
                writeFirebaseErrorToLog(e, console.error);
              } else {
                console.error(e);
                errorMessage = (e as Error).message;
              }
              enqueueSnackbar(errorMessage, { variant: "error" });
            }
          },
          (error) => {
            setIsLoggingInWithEmail(false);
            const shownError = getUserFriendlyFirebaseErrorMessage(error);
            writeFirebaseErrorToLog(error, console.error);
            enqueueSnackbar(shownError, { variant: "error" });
          }
        );
      }
    },
    [enqueueSnackbar, updateUserByToken, postLoginHandler]
  );

  /**
   * Check if the user was invited
   * @param code
   */
  const handleLoginWithInvitationCode = useCallback(
    async (code: string) => {
      try {
        setIsLoggingInAnonymously(true);
        const invitation = await invitationsService
          .checkInvitationCodeStatus(
            code
          )
        if(invitation.status !== InvitationStatus.VALID || invitation.invitation_type !== InvitationType.AUTO_REGISTER) {
          throw new Error("Invalid invitation code");
        }
        enqueueSnackbar("Invitation code is valid", { variant: "success" });
        const token = await anonymousAuthService.handleAnonymousLogin(
        );
        const _user = updateUserByToken(token);
        if (_user) {
            // create user preferences for the first time.
            // in order to do this, there needs to be a logged in user in the persistent storage
            const prefs = await userPreferencesService.createUserPreferences(
              {
                user_id: _user.id,
                invitation_code: invitation.invitation_code,
                language: Language.en,
              }
            );
            updateUserPreferences(prefs);
            postLoginHandler(_user);
        } else {
          // if a user cannot be gotten from the token, we have to throw an error
          throw new Error("User not found");
        }
      } catch (error) {
        let errorMessage;
        if (error instanceof ServiceError) {
          writeServiceErrorToLog(error, console.error);
          errorMessage = getUserFriendlyErrorMessage(error as Error);
        } else if (error instanceof FirebaseError) {
          writeFirebaseErrorToLog(error, console.error);
          errorMessage = getUserFriendlyFirebaseErrorMessage(error);
        } else {
          console.error(error);
          errorMessage = (error as Error).message;
        }
        enqueueSnackbar(errorMessage, { variant: "error" });
      } finally {
        setIsLoggingInAnonymously(false);
      }
    },
    [enqueueSnackbar, updateUserByToken, postLoginHandler, updateUserPreferences]
  );

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
      } else {
        handleLoginWithEmail(email, password);
      }
    },
    [email, handleLoginWithInvitationCode, handleLoginWithEmail, activeLoginForm, inviteCode, password]
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
      setPasswordError("");
    }
  }, [activeLoginForm]);

  /**
   * Check if there is an invite code in the URL when the component mounts
   */
  useEffect(() => {
    renderCount.current++;
    if (!inviteCodeParam && renderCount.current === 1) {
      return;
    }

    if (inviteCodeParam) {
      handleLoginWithInvitationCode(inviteCodeParam);
    }
  }, [handleLoginWithInvitationCode, inviteCodeParam]);

  /* ------------------
  * aggregated states for loading and disabling ui
  */
  // login is loading when any of the login methods return a loading state
  const isLoginLoading = isAuthenticationInProgress || isLoggingInWithEmail || isLoggingInAnonymously;
  // login button is disabled when login is loading, or when there is no active Form, or the fields for the active form are not filled in
  const isLoginButtonDisabled = isLoginLoading || activeLoginForm === ActiveForm.NONE || ((!email || !password) && !inviteCode);

  return (
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
            isDisabled={isLoginLoading}
            notifyOnFocused={() => {}} //TODO: remove this
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
            passwordError={passwordError}
            notifyOnEmailChanged={handleEmailChanged}
            notifyOnPasswordChanged={handlePasswordChanged}
            isDisabled={isLoginLoading}
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
            {isLoginLoading ? (
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
          preLoginCheck={() => true} // no checks need to happen before logging in with social providers
          postLoginHandler={successfulSocialLoginCallback}
          isLoading={isLoading}
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
      <RegistrationCodeFormModal
        show={showRegistrationCodeForm}
        onSuccess={createUserPreferencesCallback}
        onClose={() => setShowRegistrationCodeForm(false)}
      />
    </Container>
  );
};

export default Login;
