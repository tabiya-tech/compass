import React, { useContext } from "react";
import { Container, Box, Typography, useTheme, styled } from "@mui/material";
import { AuthContext, TabiyaUser } from "src/auth/AuthProvider/AuthProvider";
import { NavLink as RouterNavLink } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import IDPAuth from "src/auth/components/IDPAuth/IDPAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/error";
import { writeServiceErrorToLog } from "src/error/logger";
import RegisterWithEmailForm from "src/auth/pages/Register/components/RegisterWithEmailForm/RegisterWithEmailForm";
import AuthHeader from "src/auth/components/AuthHeader/AuthHeader";

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
  // we have to pass the notifyOnLogin function since the IDPAuth component is used in the Register component
  // and the IDPAuth behaves like a login
  postLoginHandler: (user: TabiyaUser) => void;
  // describes the loading state of the post login handlers
  isPostLoginLoading: boolean;
}

const Register: React.FC<Readonly<RegisterProps>> = ({ postRegisterHandler, postLoginHandler, isPostLoginLoading }) => {
  const theme = useTheme();
  const { registerWithEmail, isRegistering } = useContext(AuthContext);
  const { enqueueSnackbar } = useSnackbar();

  /**
   * Handle the register form submission
   * @param name
   * @param email
   * @param password
   */
  const handleRegister = (name: string, email: string, password: string) => {
    registerWithEmail(
      email,
      password,
      name,
      () => {
        postRegisterHandler();
        enqueueSnackbar("Verification Email Sent!", { variant: "success" });
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
  };

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
        <RegisterWithEmailForm notifyOnRegister={handleRegister} isRegistering={isRegistering || isPostLoginLoading} />
        <IDPAuth notifyOnLogin={postLoginHandler} isLoading={isPostLoginLoading} />
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
