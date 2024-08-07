import React, { useCallback, useContext, useState } from "react";
import { Container, Box, Typography, useTheme, styled } from "@mui/material";
import { NavLink as RouterNavLink } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import SocialAuth from "src/auth/components/SocialAuth/SocialAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import RegisterWithEmailForm from "src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";
import { getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { writeFirebaseErrorToLog } from "src/error/FirebaseError/logger";
import { AuthContext, TabiyaUser } from "src/auth/AuthProvider";
import { emailAuthService } from "src/auth/services/emailAuth/EmailAuth.service";

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
  REGISTER_CONTAINER: `register-container-${uniqueId}`,
  LOGO: `register-logo-${uniqueId}`,
  TITLE: `register-title-${uniqueId}`,
  SUBTITLE: `register-subtitle-${uniqueId}`,
  FORM: `register-form-${uniqueId}`,
  NAME_INPUT: `register-name-input-${uniqueId}`,
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

export interface RegisterProps {
  postRegisterHandler: () => void;
  // we have to pass the notifyOnLogin function since the SocialAuth component is used in the Register component
  // and the SocialAuth behaves like a login
  postLoginHandler: (user: TabiyaUser) => void;
  // describes the loading state of the post login handlers
  isPostLoginLoading: boolean;
}

const Register: React.FC<Readonly<RegisterProps>> = ({ postRegisterHandler, postLoginHandler, isPostLoginLoading }) => {
  const theme = useTheme();
  const { isAuthenticationInProgress } = useContext(AuthContext);

  const [isRegisteringWithEmail, setIsRegisteringWithEmail] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  /**
   * Handle the register form submission
   * @param name
   * @param email
   * @param password
   */
  const handleRegister = useCallback(
    (name: string, email: string, password: string) => {
      setIsRegisteringWithEmail(true);
      emailAuthService.handleRegisterWithEmail(
        email,
        password,
        name,
        () => {
          setIsRegisteringWithEmail(false);
          enqueueSnackbar("Verification Email Sent!", { variant: "success" });
          postRegisterHandler();
        },
        (e) => {
          setIsRegisteringWithEmail(false);
          let errorMessage;
          errorMessage = getUserFriendlyFirebaseErrorMessage(e);
          writeFirebaseErrorToLog(e, console.error);
          enqueueSnackbar(errorMessage, { variant: "error" });
        }
      );
    },
    [enqueueSnackbar, setIsRegisteringWithEmail, postRegisterHandler]
  );

  // register form is in the loading state if the auth context is loading, or if the user is registering with email or the post login handler is loading
  const isRegisterLoading = isAuthenticationInProgress || isRegisteringWithEmail || isPostLoginLoading;

  return (
    <Container maxWidth="xs" sx={{ height: "100%" }} data-testid={DATA_TEST_ID.REGISTER_CONTAINER}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent={"space-evenly"}
        m={4}
        height={"80%"}
      >
        <AuthHeader title={"Welcome to Compass!"} subtitle={"We need some information to get started"} />
        <RegisterWithEmailForm notifyOnRegister={handleRegister} isRegistering={isRegisterLoading} />
        <SocialAuth postLoginHandler={postLoginHandler} isLoading={isPostLoginLoading} />
        <Typography variant="body2" mt={2} data-testid={DATA_TEST_ID.LOGIN_LINK}>
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
  );
};

export default Register;
