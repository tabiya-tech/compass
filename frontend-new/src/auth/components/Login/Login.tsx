import React, { useCallback, useContext, useState } from "react";
import { Box, CircularProgress, Container, styled, TextField, Typography, useTheme } from "@mui/material";
import { AuthContext, TabiyaUser } from "src/auth/AuthProvider/AuthProvider";
import { NavLink as RouterNavLink } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import IDPAuth from "src/auth/components/IDPAuth/IDPAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import LanguageContextMenu from "src/i18n/languageContextMenu/LanguageContextMenu";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/error";
import { writeServiceErrorToLog } from "src/error/logger";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

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
  LOGO: `login-logo-${uniqueId}`,
  TITLE: `login-title-${uniqueId}`,
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
  const { login, isLoggingIn } = useContext(AuthContext);
  const { enqueueSnackbar } = useSnackbar();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /**
   * Handle the login form submission
   * @param event
   */
  const handleLogin = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      login(
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
    [email, enqueueSnackbar, login, postLoginHandler, password]
  );

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
        <Box display="flex" flexDirection="row" justifyContent="center" alignItems="center">
          <img
            src={`${process.env.PUBLIC_URL}/logo.svg`}
            alt="Logo"
            style={{ maxWidth: "60%", margin: "10%" }}
            data-testid={DATA_TEST_ID.LOGO}
          />
          <LanguageContextMenu />
        </Box>
        <Typography variant="h4" gutterBottom data-testid={DATA_TEST_ID.TITLE}>
          Welcome to Compass!
        </Typography>
        <Typography variant="body2" gutterBottom data-testid={DATA_TEST_ID.SUBTITLE}>
          Login to your account to continue
        </Typography>
        <Box component="form" mt={2} onSubmit={handleLogin} data-testid={DATA_TEST_ID.FORM}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            variant="outlined"
            margin="normal"
            disabled={isLoggingIn || isLoading}
            required
            onChange={(e) => setEmail(e.target.value)}
            inputProps={{ "data-testid": DATA_TEST_ID.EMAIL_INPUT }}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            variant="outlined"
            disabled={isLoggingIn || isLoading}
            margin="normal"
            required
            onChange={(e) => setPassword(e.target.value)}
            inputProps={{ "data-testid": DATA_TEST_ID.PASSWORD_INPUT }}
          />
          <PrimaryButton
            fullWidth
            variant="contained"
            color="primary"
            style={{ marginTop: 16 }}
            type="submit"
            disabled={isLoggingIn || isLoading}
            disableWhenOffline={true}
            data-testid={DATA_TEST_ID.LOGIN_BUTTON}
          >
            {isLoggingIn || isLoading ? (
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
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          mt={(theme) => theme.tabiyaSpacing.lg}
          data-testid={DATA_TEST_ID.FIREBASE_AUTH_CONTAINER}
        >
          <Typography variant="body2" mt={2} data-testid={DATA_TEST_ID.LOGIN_USING}>
            Or continue with
          </Typography>
          <Box mt={2} width="100%">
            <IDPAuth notifyOnLogin={postLoginHandler} isLoading={isLoading} />
          </Box>
        </Box>
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
