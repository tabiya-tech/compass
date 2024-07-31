import React, { useCallback, useContext, useEffect, useRef } from "react";
import { Box, Container, styled, Typography, useTheme } from "@mui/material";
import { EmailAuthContext, TabiyaUser } from "src/auth/emailAuth/EmailAuthProvider/EmailAuthProvider";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import IDPAuth from "src/auth/components/IDPAuth/IDPAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/error";
import { writeServiceErrorToLog } from "src/error/logger";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import LoginWithEmailForm from "src/auth/pages/Login/components/LoginWithEmailForm/LoginWithEmailForm";
import { InvitationsContext } from "src/invitations/InvitationsProvider/InvitationsProvider";
import { AnonymousAuthContext } from "../../anonymousAuth/AnonymousAuthProvider/AnonymousAuthProvider";

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

const Login: React.FC<Readonly<LoginProps>> = ({ postLoginHandler, isLoading }) => {
  const theme = useTheme();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const inviteCode = params.get(INVITATIONS_PARAM_NAME);

  const renderCount = useRef(0);

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
      loginWithEmail(
        email,
        password,
        async (user) => {
          try {
            postLoginHandler(user);
          } catch (e) {
            const errorMessage = getUserFriendlyErrorMessage(e as Error);
            enqueueSnackbar(errorMessage, { variant: "error" });
            console.error("Error during login process", e);
          }
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

  // Check if the user was invited
  useEffect(() => {
    renderCount.current++;
    if (!inviteCode && renderCount.current === 1) {
      return;
    }

    if (inviteCode) {
      handleCheckIfInvited(inviteCode);
    }
  }, [handleCheckIfInvited, inviteCode]);
  const isLoginLoading = isLoggingInWithEmail || isLoggingInAnonymously || isInvitationCheckLoading;

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
        <LoginWithEmailForm notifyOnLogin={handleLoginWithEmail} isLoggingIn={isLoginLoading} />
        <IDPAuth notifyOnLogin={postLoginHandler} isLoading={isLoading} />
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
    </Container>
  );
};

export default Login;
