import React, { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Container, Link, TextField, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import FirebaseEmailAuthenticationService from "src/auth/services/FirebaseAuthenticationService/FirebaseEmailAuthenticationService";
import { FirebaseError } from "src/error/FirebaseError/firebaseError";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { getDarkLogoUrl } from "src/envService";
import UserStateService from "src/userState/UserStateService";
import { registrationsService, RegistrationStatus } from "src/pages/Register/registrationsService";

const uniqueId = "login-page-5a8f3b2c-1d4e-4f6a-9b8c-7e2d1f0a3b5c";

export const DATA_TEST_ID = {
  LOGIN_PAGE_CONTAINER: `${uniqueId}-container`,
  LOGIN_PAGE_LOGO: `${uniqueId}-logo`,
  LOGIN_PAGE_TITLE: `${uniqueId}-title`,
  LOGIN_PAGE_EMAIL_INPUT: `${uniqueId}-email-input`,
  LOGIN_PAGE_PASSWORD_INPUT: `${uniqueId}-password-input`,
  LOGIN_PAGE_SUBMIT_BUTTON: `${uniqueId}-submit-button`,
  LOGIN_PAGE_LOADING_SPINNER: `${uniqueId}-loading-spinner`,
};

export interface LoginProps {}

const Login: React.FC<LoginProps> = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const preferredLocal = `${process.env.PUBLIC_URL}/njila-logo-dark.svg`;
  const preferredSrc = getDarkLogoUrl() || preferredLocal;
  const [logoSrc, setLogoSrc] = useState(preferredSrc);

  useEffect(() => {
    setLogoSrc(preferredSrc);
  }, [preferredSrc]);

  const getErrorMessage = (error: FirebaseError): string => {
    switch (error.code) {
      case FirebaseErrorCodes.USER_NOT_FOUND:
      case FirebaseErrorCodes.WRONG_PASSWORD:
      case FirebaseErrorCodes.INVALID_CREDENTIAL:
        return t("login.errors.invalidCredentials", "Invalid email or password");
      case FirebaseErrorCodes.USER_DISABLED:
        return t("login.errors.userDisabled", "This account has been disabled");
      case FirebaseErrorCodes.TOO_MANY_REQUESTS:
        return t("login.errors.tooManyRequests", "Too many failed attempts. Please try again later");
      case FirebaseErrorCodes.NETWORK_REQUEST_FAILED:
        return t("login.errors.networkError", "Network error. Please check your connection");
      case FirebaseErrorCodes.INVALID_EMAIL:
        return t("login.errors.invalidEmail", "Please enter a valid email address");
      default:
        return t("login.errors.generic", "Login failed. Please try again");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !password) {
      enqueueSnackbar(t("login.errors.fillAllFields", "Please fill in all fields"), { variant: "warning" });
      return;
    }

    setIsLoading(true);

    try {
      const authService = FirebaseEmailAuthenticationService.getInstance();
      await authService.login(email, password);
      const redirectPath = UserStateService.getInstance().isInstitutionStaff()
        ? routerPaths.INSTRUCTOR
        : routerPaths.ROOT;
      navigate(redirectPath);
    } catch (error) {
      console.error("Login error:", error);
      const isInvalidCredential =
        error instanceof FirebaseError &&
        (error.code === FirebaseErrorCodes.USER_NOT_FOUND || error.code === FirebaseErrorCodes.INVALID_CREDENTIAL);

      // If the credentials look invalid, see if the email matches a pending/rejected
      // registration so we can give a more helpful message.
      if (isInvalidCredential) {
        try {
          const status = await registrationsService.getStatus(email);
          if (status.status === RegistrationStatus.PENDING) {
            enqueueSnackbar(
              t(
                "login.errors.registrationPending",
                "Your registration is still pending approval. You will receive an email once approved."
              ),
              { variant: "info" }
            );
            return;
          }
          if (status.status === RegistrationStatus.REJECTED) {
            enqueueSnackbar(
              t(
                "login.errors.registrationRejected",
                "Your registration was not approved. Please contact your administrator."
              ),
              { variant: "warning" }
            );
            return;
          }
        } catch (lookupError) {
          // Best effort — fall through to the generic Firebase error.
          console.warn("Failed to look up registration status:", lookupError);
        }
      }

      if (error instanceof FirebaseError) {
        enqueueSnackbar(getErrorMessage(error), { variant: "error" });
      } else {
        enqueueSnackbar(t("login.errors.generic", "Login failed. Please try again"), { variant: "error" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" data-testid={DATA_TEST_ID.LOGIN_PAGE_CONTAINER}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <Box
          sx={{
            padding: theme.spacing(4),
            width: "100%",
            borderRadius: theme.tabiyaRounding.sm,
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          {/* Logo */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              marginBottom: theme.tabiyaSpacing.lg,
            }}
          >
            <Box
              component="img"
              src={logoSrc}
              alt={t("login.logoAlt", "Logo")}
              data-testid={DATA_TEST_ID.LOGIN_PAGE_LOGO}
              onError={() => {
                setLogoSrc((prev) => (prev === preferredLocal ? prev : preferredLocal));
              }}
              sx={{
                height: 64,
                width: "auto",
                maxWidth: "100%",
              }}
            />
          </Box>

          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            textAlign="center"
            data-testid={DATA_TEST_ID.LOGIN_PAGE_TITLE}
          >
            {t("login.title", "Admin Login")}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            textAlign="center"
            sx={{ marginBottom: theme.tabiyaSpacing.lg }}
          >
            {t("login.subtitle", "Sign in to access the admin portal")}
          </Typography>

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label={t("login.email", "Email")}
              type="email"
              margin="normal"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              autoFocus
              data-testid={DATA_TEST_ID.LOGIN_PAGE_EMAIL_INPUT}
            />
            <TextField
              fullWidth
              label={t("login.password", "Password")}
              type="password"
              margin="normal"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
              data-testid={DATA_TEST_ID.LOGIN_PAGE_PASSWORD_INPUT}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{ mt: 3, mb: 2, height: 48 }}
              data-testid={DATA_TEST_ID.LOGIN_PAGE_SUBMIT_BUTTON}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" data-testid={DATA_TEST_ID.LOGIN_PAGE_LOADING_SPINNER} />
              ) : (
                t("login.submit", "Sign In")
              )}
            </Button>
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
              <Link component="button" type="button" onClick={() => navigate(routerPaths.FORGOT_PASSWORD)}>
                {t("login.forgotPassword", "Forgot password?")}
              </Link>
              <Link component="button" type="button" onClick={() => navigate(routerPaths.REGISTER)}>
                {t("login.requestAccess", "Request access")}
              </Link>
            </Box>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default Login;
