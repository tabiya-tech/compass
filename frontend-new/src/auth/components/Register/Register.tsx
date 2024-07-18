import React, { useContext, useState } from "react";
import { Container, Box, TextField, Button, Typography, useTheme, styled, CircularProgress } from "@mui/material";
import { AuthContext } from "src/auth/Providers/AuthProvider/AuthProvider";
import { NavLink as RouterNavLink, useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import IDPAuth from "src/auth/components/IDPAuth/IDPAuth";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import AuthContextMenu from "src/auth/components/AuthContextMenu/AuthContextMenu";
import { validatePassword } from "src/auth/components/Register/utils/validatePassword";
import { getUserFriendlyErrorMessage, ServiceError } from "src/error/error";
import { writeServiceErrorToLog } from "src/error/logger";

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

const Register: React.FC = () => {
  const theme = useTheme();
  const { register, isRegistering } = useContext(AuthContext);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>("");

  /**
   * Handle the register form submission
   * @param event
   */
  const handleRegister = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const passwordValidationResult = validatePassword(password);
    setPasswordError(passwordValidationResult);

    if (passwordValidationResult === "") {
      register(
        email,
        password,
        name,
        () => {
          navigate(routerPaths.VERIFY_EMAIL, { replace: true });
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
    }
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
          We need some information to get started
        </Typography>
        <Box component="form" mt={2} onSubmit={handleRegister} data-testid={DATA_TEST_ID.FORM}>
          <TextField
            fullWidth
            label="Name"
            variant="outlined"
            margin="normal"
            disabled={isRegistering}
            required
            onChange={(e) => setName(e.target.value)}
            inputProps={{ "data-testid": DATA_TEST_ID.NAME_INPUT }}
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            disabled={isRegistering}
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
            disabled={isRegistering}
            variant="outlined"
            margin="normal"
            required
            onChange={(e) => setPassword(e.target.value)}
            inputProps={{ "data-testid": DATA_TEST_ID.PASSWORD_INPUT }}
            error={!!passwordError}
            helperText={passwordError}
          />
          <Button
            fullWidth
            variant="contained"
            color="primary"
            style={{ marginTop: 16 }}
            type="submit"
            disabled={isRegistering}
            data-testid={DATA_TEST_ID.REGISTER_BUTTON}
          >
            {isRegistering ? (
              <CircularProgress
                color={"secondary"}
                aria-label={"Registering"}
                data-testid={DATA_TEST_ID.REGISTER_BUTTON_CIRCULAR_PROGRESS}
                size={16}
                sx={{ marginTop: theme.tabiyaSpacing.sm, marginBottom: theme.tabiyaSpacing.sm }}
              />
            ) : (
              "Register"
            )}
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
          <Typography variant="body2" mt={2} data-testid={DATA_TEST_ID.REGISTER_USING}>
            Or continue with
          </Typography>
          <Box mt={2} width="100%">
            <IDPAuth />
          </Box>
        </Box>
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
