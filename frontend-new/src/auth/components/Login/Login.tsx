import React, { useCallback, useContext, useState } from "react";
import { Container, Box, TextField, Button, Typography, useTheme, styled } from "@mui/material";
import { AuthContext, TabiyaUser } from "src/auth/AuthProvider";
import { NavLink as RouterNavLink, useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import IDPAuth from "src/auth/components/IDPAuth/IDPAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import UserPreferencesService from "src/auth/services/UserPreferences/userPreferences.service";
import AuthContextMenu from "src/auth/components/AuthContextMenu/AuthContextMenu";

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
  FORGOT_PASSWORD_LINK: `login-forgot-password-link-${uniqueId}`,
  LOGIN_USING: `login-using-${uniqueId}`,
  FIREBASE_AUTH_CONTAINER: `firebase-auth-container-${uniqueId}`,
  LOGIN_LINK: `login-login-link-${uniqueId}`,
  LANGUAGE_SELECTOR: `login-language-selector-${uniqueId}`,
};

const Login: React.FC = () => {
  const theme = useTheme();
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  /**
   * Check if the user has accepted the terms and conditions
   * @param user
   */
  const checkUserPreferences = useCallback(
    async (user: TabiyaUser) => {
      const userPreferencesService = new UserPreferencesService();
      try {
        const userPreferences = await userPreferencesService.getUserPreferences(user.id);
        const acceptedTcDate = new Date(userPreferences.accepted_tc);
        // If the accepted_tc is not set or is not a valid date, redirect to the DPA page
        // this is to ensure that even if the accepted_tc is manipulated in the database, the user will be redirected to the DPA page
        // and will have to accept the terms and conditions again
        if (!userPreferences.accepted_tc || isNaN(acceptedTcDate.getTime())) {
          navigate(routerPaths.DPA, { replace: true });
        } else {
          navigate(routerPaths.ROOT, { replace: true });
        }
      } catch (e) {
        enqueueSnackbar("Failed to fetch user preferences", { variant: "error" });
        console.error("Failed to fetch user preferences", e);
      }
    },
    [navigate, enqueueSnackbar]
  );

  /**
   * Handle the login form submission
   * @param event
   */
  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login(
      email,
      password,
      async (user) => {
        await checkUserPreferences(user);
        enqueueSnackbar("Login successful", { variant: "success" });
      },
      (error) => {
        if (error.message === "Email not verified") {
          enqueueSnackbar("Please verify your email", { variant: "error" });
          return;
        }
        console.error("Login failed", error);
        enqueueSnackbar("Login failed", { variant: "error" });
      }
    );
  };

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
          <AuthContextMenu />
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
            required
            onChange={(e) => setEmail(e.target.value)}
            inputProps={{ "data-testid": DATA_TEST_ID.EMAIL_INPUT }}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            variant="outlined"
            margin="normal"
            required
            onChange={(e) => setPassword(e.target.value)}
            inputProps={{ "data-testid": DATA_TEST_ID.PASSWORD_INPUT }}
          />
          <Button
            fullWidth
            variant="contained"
            color="primary"
            style={{ marginTop: 16 }}
            type="submit"
            data-testid={DATA_TEST_ID.LOGIN_BUTTON}
          >
            Login
          </Button>
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
            <IDPAuth />
          </Box>
        </Box>
        <Typography variant="body2" mt={2} data-testid={DATA_TEST_ID.LOGIN_LINK}>
          Dont have an account?{" "}
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
