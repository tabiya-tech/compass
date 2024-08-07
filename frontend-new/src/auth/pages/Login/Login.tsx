import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Container, styled, Typography, useTheme } from "@mui/material";
import { EmailAuthContext, TabiyaUser } from "src/auth/emailAuth/EmailAuthProvider/EmailAuthProvider";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import IDPAuth from "src/auth/components/IDPAuth/IDPAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/ServiceError/ServiceError";
import { writeServiceErrorToLog } from "src/error/ServiceError/logger";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import LoginWithEmailForm from "src/auth/pages/Login/components/LoginWithEmailForm/LoginWithEmailForm";
import { InvitationsContext } from "src/invitations/InvitationsProvider/InvitationsProvider";
import { AnonymousAuthContext } from "src/auth/anonymousAuth/AnonymousAuthProvider/AnonymousAuthProvider";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import LoginWithInviteCodeForm from "./components/LoginWithInviteCodeForm/LoginWithInviteCodeForm";
import { validatePassword } from "src/auth/utils/validatePassword";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { writeFirebaseErrorToLog } from "src/error/FirebaseError/logger";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import RegistrationCodeFormModal from "src/invitations/components/RegistrationCodeFormModal/RegistrationCodeFormModal";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";

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
  const [showInviteCodeForm, setShowInviteCodeForm] = useState(false);

  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>("");

  const [activeLoginForm, setActiveLoginForm] = useState(ActiveForm.NONE);

  const { loginWithEmail, isLoggingInWithEmail } = useContext(EmailAuthContext);
  const { isLoggingInAnonymously } = useContext(AnonymousAuthContext);
  const { checkInvitationStatus, isInvitationCheckLoading } = useContext(InvitationsContext);
  const { enqueueSnackbar } = useSnackbar();

  /**
   * Handle the login form submission
   * @param event
   */
  const handleLoginWithEmail = useCallback(
    (email: string, password: string) => {
      const passwordValidationResult = validatePassword(password);
      setPasswordError(passwordValidationResult);

      if (passwordValidationResult === "" && email && password) {
        loginWithEmail(
          email,
          password,
          async (user) => {
            try {

              // check user preference status.


              postLoginHandler(user);
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
          (e) => {
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
        );
      }
    },
    [enqueueSnackbar, loginWithEmail, postLoginHandler]
  );

  /**
   * Check if the user was invited
   * @param code
   */
  const handleCheckIfInvited = useCallback(
    (code: string) => {
      checkInvitationStatus(
        code,
        (user) => {
          enqueueSnackbar("Invitation code is valid", { variant: "success" });
          postLoginHandler(user);
        },
        (e) => {
          if (e instanceof ServiceError) {
            writeServiceErrorToLog(e, console.error);
          } else {
            console.error(e);
          }
          const errorMessage = getUserFriendlyErrorMessage(e);
          enqueueSnackbar(errorMessage, { variant: "error" });
        }
      );
    },
    [checkInvitationStatus, enqueueSnackbar, postLoginHandler]
  );

  // callbacks to pass on to child components
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

  // clear whichever form is not active
  useEffect(() => {
    if (activeLoginForm === ActiveForm.EMAIL) {
      setInviteCode("");
    } else if (activeLoginForm === ActiveForm.INVITE_CODE) {
      setEmail("");
      setPassword("");
      setPasswordError("");
    }
  }, [activeLoginForm]);

  // depending on which form is active, handle submit button
  const handleLoginSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (activeLoginForm === ActiveForm.INVITE_CODE) {
        handleCheckIfInvited(inviteCode);
      } else {
        handleLoginWithEmail(email, password);
      }
    },
    [email, handleCheckIfInvited, handleLoginWithEmail, activeLoginForm, inviteCode, password]
  );

  // Check if the user was invited by checking the invite code in the URL
  useEffect(() => {
    renderCount.current++;
    if (!inviteCodeParam && renderCount.current === 1) {
      return;
    }

    if (inviteCodeParam) {
      handleCheckIfInvited(inviteCodeParam);
    }
  }, [handleCheckIfInvited, inviteCodeParam]);

  // login is loading when any of the login methods return a loading state
  const isLoginLoading = isLoggingInWithEmail || isLoggingInAnonymously || isInvitationCheckLoading;
  // login button is disabled when login is loading, or when there is no active Form, or the fields for the active form are not filled in
  const isLoginButtonDisabled =
    isLoginLoading || activeLoginForm === ActiveForm.NONE || ((!email || !password) && !inviteCode);

  const socialLoginHandler = async (user: TabiyaUser) => {
    try {
      const userPreferences = await userPreferencesService.getUserPreferences(user.id);

      if(!userPreferences.accepted_tc) {
        // user is not created show the invitation code modal
        setTempUser(user);
        setShowInviteCodeForm(true);
        return;
      }

      postLoginHandler(user);
    } catch (e) {
      console.log(e)

      const errorMessage = getUserFriendlyErrorMessage(e as Error);
      enqueueSnackbar(errorMessage, { variant: "error" });
      console.error("Error during login process", e);
    }
  }

  const createUser = async (invitationCode: string) => {
    try {
      await userPreferencesService.createUserPreferences({
        user_id: tempUser?.id!,
        language: Language.en,
        invitation_code: invitationCode,
      });

      postLoginHandler(tempUser!);
    } catch (e) {
      console.log(e)

      const errorMessage = getUserFriendlyErrorMessage(e as Error);
      enqueueSnackbar(errorMessage, { variant: "error" });
      console.error("Error during login")
    }
  }

  return (
    <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.LOGIN_CONTAINER}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent={"space-evenly"}
        m={4}
        height={"80%"}
      >
        <AuthHeader title={"Welcome to Compass!"} subtitle={"Login to your account to continue"} />
        <Box
          component="form"
          mt={2}
          onSubmit={handleLoginSubmit}
          data-testid={DATA_TEST_ID.FORM}
          display={"flex"}
          flexDirection={"column"}
          gap={theme.tabiyaSpacing.xs}
          padding={theme.tabiyaSpacing.xs}
          textAlign={"center"}
        >
          <Typography variant="caption" data-testid={DATA_TEST_ID.SUBTITLE}>
            Login using
          </Typography>
          <LoginWithInviteCodeForm
            inviteCode={inviteCode}
            notifyOnInviteCodeChanged={handleInviteCodeChanged}
            isDisabled={isLoginLoading}
            notifyOnFocused={() => {}}
          />
          <Typography variant="caption" data-testid={DATA_TEST_ID.SUBTITLE}>
            Or
          </Typography>
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
        <IDPAuth
          disabled={false}
          preLoginCheck={() => true}
          notifyOnLogin={socialLoginHandler}
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
         show={showInviteCodeForm}
         onSuccess={createUser}
         onClose={() => setShowInviteCodeForm(false)}
      />
    </Container>
  );
};

export default Login;
