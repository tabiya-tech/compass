import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, CircularProgress, Container, Link, TextField, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { firebaseAuth } from "src/auth/firebaseConfig";
import { routerPaths } from "src/app/routerPaths";
import { getDarkLogoUrl } from "src/envService";

const uniqueId = "auth-handler-page-4a2b8c1d-3e5f-6a7b-8c9d-0e1f2a3b4c5d";

export const DATA_TEST_ID = {
  CONTAINER: `${uniqueId}-container`,
  LOGO: `${uniqueId}-logo`,
  TITLE: `${uniqueId}-title`,
  NEW_PASSWORD: `${uniqueId}-new-password`,
  CONFIRM_PASSWORD: `${uniqueId}-confirm-password`,
  SUBMIT: `${uniqueId}-submit`,
  BACK_TO_LOGIN: `${uniqueId}-back-to-login`,
  LOADING: `${uniqueId}-loading`,
  ERROR_ALERT: `${uniqueId}-error-alert`,
  SUCCESS_ALERT: `${uniqueId}-success-alert`,
};

type Mode = "resetPassword" | "recoverEmail" | "verifyEmail";

enum Status {
  PROCESSING = "PROCESSING",
  AWAITING_INPUT = "AWAITING_INPUT",
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
}

const getQueryParams = (search: string): URLSearchParams => {
  if (search) return new URLSearchParams(search);
  if (window.location.search) return new URLSearchParams(window.location.search);
  const hashQuery = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
  return new URLSearchParams(hashQuery);
};

const AuthHandler: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const params = useMemo(() => getQueryParams(location.search), [location.search]);
  const mode = params.get("mode") as Mode | null;
  const oobCode = params.get("oobCode");

  const [status, setStatus] = useState<Status>(Status.PROCESSING);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logoSrc = getDarkLogoUrl() || `${process.env.PUBLIC_URL}/njila-logo-dark.svg`;

  const goToLogin = useCallback(() => {
    navigate(routerPaths.LOGIN, { replace: true });
  }, [navigate]);

  const handleError = useCallback((message: string) => {
    setErrorMessage(message);
    setStatus(Status.ERROR);
  }, []);

  const handleVerifyResetCode = useCallback(async () => {
    if (!oobCode) return;
    try {
      const email = await firebaseAuth.verifyPasswordResetCode(oobCode);
      setAccountEmail(email);
      setStatus(Status.AWAITING_INPUT);
    } catch {
      handleError(t("authHandler.errors.invalidLink"));
    }
  }, [oobCode, handleError, t]);

  const handleVerifyEmail = useCallback(async () => {
    if (!oobCode) return;
    try {
      await firebaseAuth.applyActionCode(oobCode);
      setStatus(Status.SUCCESS);
    } catch {
      handleError(t("authHandler.errors.invalidLink"));
    }
  }, [oobCode, handleError, t]);

  const handleRecoverEmail = useCallback(async () => {
    if (!oobCode) return;
    try {
      const info = await firebaseAuth.checkActionCode(oobCode);
      await firebaseAuth.applyActionCode(oobCode);
      setAccountEmail(info.data.email ?? null);
      setStatus(Status.SUCCESS);
    } catch {
      handleError(t("authHandler.errors.invalidLink"));
    }
  }, [oobCode, handleError, t]);

  useEffect(() => {
    if (!mode || !oobCode) {
      handleError(t("authHandler.errors.invalidLink"));
      return;
    }
    switch (mode) {
      case "resetPassword":
        handleVerifyResetCode();
        break;
      case "verifyEmail":
        handleVerifyEmail();
        break;
      case "recoverEmail":
        handleRecoverEmail();
        break;
      default:
        handleError(t("authHandler.errors.unknownMode"));
    }
  }, [mode, oobCode, handleVerifyResetCode, handleVerifyEmail, handleRecoverEmail, handleError, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;
    if (newPassword !== confirmPassword) return;
    setIsSubmitting(true);
    try {
      await firebaseAuth.confirmPasswordReset(oobCode, newPassword);
      setStatus(Status.SUCCESS);
    } catch {
      handleError(t("authHandler.errors.resetFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordsMatch = newPassword === confirmPassword;
  const isSubmitDisabled = isSubmitting || newPassword.length < 6 || !passwordsMatch;

  const title = useMemo(() => {
    if (status === Status.ERROR) return t("authHandler.errors.title");
    switch (mode) {
      case "resetPassword":
        return t("authHandler.resetPassword.title");
      case "verifyEmail":
        return t("authHandler.verifyEmail.title");
      case "recoverEmail":
        return t("authHandler.recoverEmail.title");
      default:
        return t("authHandler.errors.title");
    }
  }, [mode, status, t]);

  return (
    <Container maxWidth="sm" data-testid={DATA_TEST_ID.CONTAINER}>
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
          <Box sx={{ display: "flex", justifyContent: "center", marginBottom: theme.tabiyaSpacing.lg }}>
            <Box
              component="img"
              src={logoSrc}
              alt={t("authHandler.logoAlt")}
              data-testid={DATA_TEST_ID.LOGO}
              sx={{ height: 64, width: "auto", maxWidth: "100%" }}
            />
          </Box>

          <Typography variant="h4" component="h1" gutterBottom textAlign="center" data-testid={DATA_TEST_ID.TITLE}>
            {title}
          </Typography>

          {status === Status.PROCESSING && (
            <Box display="flex" justifyContent="center" mt={2}>
              <CircularProgress data-testid={DATA_TEST_ID.LOADING} />
            </Box>
          )}

          {status === Status.ERROR && (
            <>
              <Alert severity="error" sx={{ mt: 2 }} data-testid={DATA_TEST_ID.ERROR_ALERT}>
                {errorMessage}
              </Alert>
              <Typography variant="body2" textAlign="center" sx={{ mt: 2 }}>
                <Link component="button" type="button" onClick={goToLogin} data-testid={DATA_TEST_ID.BACK_TO_LOGIN}>
                  {t("authHandler.backToLogin")}
                </Link>
              </Typography>
            </>
          )}

          {status === Status.AWAITING_INPUT && mode === "resetPassword" && (
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              {accountEmail && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t("authHandler.resetPassword.subtitle", { email: accountEmail })}
                </Typography>
              )}
              <TextField
                fullWidth
                label={t("authHandler.resetPassword.newPassword")}
                type="password"
                margin="normal"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSubmitting}
                inputProps={{ "data-testid": DATA_TEST_ID.NEW_PASSWORD }}
                autoFocus
              />
              <TextField
                fullWidth
                label={t("authHandler.resetPassword.confirmPassword")}
                type="password"
                margin="normal"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                error={confirmPassword !== "" && !passwordsMatch}
                helperText={
                  confirmPassword !== "" && !passwordsMatch ? t("authHandler.resetPassword.passwordMismatch") : ""
                }
                inputProps={{ "data-testid": DATA_TEST_ID.CONFIRM_PASSWORD }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={isSubmitDisabled}
                sx={{ mt: 3, mb: 2, height: 48 }}
                data-testid={DATA_TEST_ID.SUBMIT}
              >
                {isSubmitting ? <CircularProgress size={24} color="inherit" /> : t("authHandler.resetPassword.submit")}
              </Button>
              <Typography variant="body2" textAlign="center">
                <Link component="button" type="button" onClick={goToLogin} data-testid={DATA_TEST_ID.BACK_TO_LOGIN}>
                  {t("authHandler.backToLogin")}
                </Link>
              </Typography>
            </Box>
          )}

          {status === Status.SUCCESS && (
            <>
              <Alert severity="success" sx={{ mt: 2 }} data-testid={DATA_TEST_ID.SUCCESS_ALERT}>
                {mode === "resetPassword" && t("authHandler.resetPassword.success")}
                {mode === "verifyEmail" && t("authHandler.verifyEmail.success")}
                {mode === "recoverEmail" &&
                  (accountEmail
                    ? t("authHandler.recoverEmail.successWithEmail", { email: accountEmail })
                    : t("authHandler.recoverEmail.success"))}
              </Alert>
              <Typography variant="body2" textAlign="center" sx={{ mt: 2 }}>
                <Link component="button" type="button" onClick={goToLogin} data-testid={DATA_TEST_ID.BACK_TO_LOGIN}>
                  {t("authHandler.backToLogin")}
                </Link>
              </Typography>
            </>
          )}
        </Box>
      </Box>
    </Container>
  );
};

export default AuthHandler;
