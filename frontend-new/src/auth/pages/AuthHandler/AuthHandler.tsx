import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, CircularProgress, TextField, Typography, useTheme } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { firebaseAuth } from "src/auth/firebaseConfig";
import { routerPaths } from "src/app/routerPaths";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import PasswordInput from "src/theme/PasswordInput/PasswordInput";
import { outlinedNoBorderSx } from "src/auth/pages/authInputStyles";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import {
  castToFirebaseError,
  getFirebaseErrorFactory,
  getUserFriendlyFirebaseErrorMessage,
} from "src/error/FirebaseError/firebaseError";
import { useAuthPageContext } from "src/auth/components/AuthLayout/AuthPageContext";

const uniqueId = "f3d2a418-9f4e-4f1d-9f9f-5b3a8d2c4e10";

export const DATA_TEST_ID = {
  AUTH_HANDLER_CONTAINER: `auth-handler-container-${uniqueId}`,
  TITLE: `auth-handler-title-${uniqueId}`,
  SUBTITLE: `auth-handler-subtitle-${uniqueId}`,
  RESET_FORM: `auth-handler-reset-form-${uniqueId}`,
  NEW_PASSWORD_INPUT: `auth-handler-new-password-${uniqueId}`,
  CONFIRM_PASSWORD_INPUT: `auth-handler-confirm-password-${uniqueId}`,
  SUBMIT_BUTTON: `auth-handler-submit-${uniqueId}`,
  BACK_TO_LOGIN_BUTTON: `auth-handler-back-to-login-${uniqueId}`,
  LOADING_SPINNER: `auth-handler-loading-${uniqueId}`,
};

type Mode = "resetPassword" | "recoverEmail" | "verifyEmail";

enum Status {
  PROCESSING = "PROCESSING",
  AWAITING_INPUT = "AWAITING_INPUT",
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
}

const REDIRECT_DELAY_MS = 3000;

const getQueryParams = (search: string): URLSearchParams => {
  // With a hash router Firebase usually appends params after the hash, so location.search has them.
  // If the install was done with a non-hash URL (or a redirect stripped them), fall back to window.location.search.
  // If that's also empty, parse params from the hash fragment (e.g. /#/auth-handler?mode=...&oobCode=...).
  if (search) return new URLSearchParams(search);
  if (window.location.search) return new URLSearchParams(window.location.search);
  const hashQuery = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
  return new URLSearchParams(hashQuery);
};

const AuthHandler: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { enqueueSnackbar } = useSnackbar();
  const { setPageLoading } = useAuthPageContext();

  const params = useMemo(() => getQueryParams(location.search), [location.search]);
  const mode = params.get("mode") as Mode | null;
  const oobCode = params.get("oobCode");
  const continueUrl = params.get("continueUrl");

  const [status, setStatus] = useState<Status>(Status.PROCESSING);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isPasswordValid, setIsPasswordValid] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const goToLogin = useCallback(() => {
    if (continueUrl) {
      try {
        const url = new URL(continueUrl);
        // Only honour external continueUrl if it points to the same origin (avoid open redirect).
        if (url.origin === window.location.origin) {
          window.location.href = continueUrl;
          return;
        }
      } catch {
        // fall through and use the in-app login path
      }
    }
    navigate(routerPaths.LOGIN, { replace: true });
  }, [continueUrl, navigate]);

  const handleFirebaseError = useCallback((where: string, error: unknown) => {
    const firebaseError = castToFirebaseError(error, getFirebaseErrorFactory("AuthHandler", where));
    console.warn(firebaseError);
    const friendly = getUserFriendlyFirebaseErrorMessage(firebaseError);
    setErrorMessage(friendly);
    setStatus(Status.ERROR);
  }, []);

  // Verify email — apply the action code immediately, then redirect to login.
  const handleVerifyEmail = useCallback(async () => {
    if (!oobCode) return;
    try {
      await firebaseAuth.applyActionCode(oobCode);
      setStatus(Status.SUCCESS);
      enqueueSnackbar(t("auth.pages.authHandler.verifyEmailSuccess"), { variant: "success" });
    } catch (error) {
      handleFirebaseError("verifyEmail", error);
    }
  }, [oobCode, enqueueSnackbar, t, handleFirebaseError]);

  // Recover email — restore the previous email, then offer a password reset for safety.
  const handleRecoverEmail = useCallback(async () => {
    if (!oobCode) return;
    try {
      const info = await firebaseAuth.checkActionCode(oobCode);
      const restoredEmail = info.data.email ?? null;
      await firebaseAuth.applyActionCode(oobCode);
      setAccountEmail(restoredEmail);
      if (restoredEmail) {
        try {
          await firebaseAuth.sendPasswordResetEmail(restoredEmail);
        } catch (resetErr) {
          // Non-fatal: the email was successfully reverted, the user just won't get a password reset email.
          console.warn("Failed to send password reset after email recovery", resetErr);
        }
      }
      setStatus(Status.SUCCESS);
    } catch (error) {
      handleFirebaseError("recoverEmail", error);
    }
  }, [oobCode, handleFirebaseError]);

  // Password reset — verify the code first to get the email, then wait for user input.
  const handleVerifyResetCode = useCallback(async () => {
    if (!oobCode) return;
    try {
      const email = await firebaseAuth.verifyPasswordResetCode(oobCode);
      setAccountEmail(email);
      setStatus(Status.AWAITING_INPUT);
    } catch (error) {
      handleFirebaseError("verifyPasswordResetCode", error);
    }
  }, [oobCode, handleFirebaseError]);

  const handleConfirmReset = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!oobCode) return;
      if (!isPasswordValid) {
        enqueueSnackbar(t("auth.pages.authHandler.passwordRequirementsNotMet"), { variant: "error" });
        return;
      }
      if (newPassword !== confirmPassword) {
        enqueueSnackbar(t("common.validation.passwordsDoNotMatch"), { variant: "error" });
        return;
      }
      setIsSubmitting(true);
      try {
        await firebaseAuth.confirmPasswordReset(oobCode, newPassword);
        setStatus(Status.SUCCESS);
        enqueueSnackbar(t("auth.pages.authHandler.passwordResetSuccess"), { variant: "success" });
      } catch (error) {
        handleFirebaseError("confirmPasswordReset", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [oobCode, newPassword, confirmPassword, isPasswordValid, enqueueSnackbar, t, handleFirebaseError]
  );

  // Kick off the right flow once on mount.
  useEffect(() => {
    if (!mode || !oobCode) {
      setErrorMessage(t("auth.pages.authHandler.errors.invalidLink"));
      setStatus(Status.ERROR);
      return;
    }
    switch (mode) {
      case "verifyEmail":
        handleVerifyEmail();
        break;
      case "recoverEmail":
        handleRecoverEmail();
        break;
      case "resetPassword":
        handleVerifyResetCode();
        break;
      default:
        setErrorMessage(t("auth.pages.authHandler.errors.unknownMode"));
        setStatus(Status.ERROR);
    }
  }, [mode, oobCode, handleVerifyEmail, handleRecoverEmail, handleVerifyResetCode, t]);

  // For verifyEmail, redirect to login after a short delay so the user can read the confirmation.
  useEffect(() => {
    if (mode === "verifyEmail" && status === Status.SUCCESS) {
      const timer = setTimeout(goToLogin, REDIRECT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [mode, status, goToLogin]);

  // Reflect the in-page submit spinner on the layout-wide backdrop too, like other auth pages do.
  useEffect(() => {
    setPageLoading(isSubmitting, t("auth.pages.authHandler.savingPassword"));
  }, [isSubmitting, setPageLoading, t]);

  const renderProcessing = () => (
    <Box display="flex" flexDirection="column" alignItems="center" gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
      <CircularProgress
        color="inherit"
        aria-label={t("auth.pages.authHandler.processing")}
        data-testid={DATA_TEST_ID.LOADING_SPINNER}
      />
      <Typography variant="body1">{t("auth.pages.authHandler.processing")}</Typography>
    </Box>
  );

  const renderError = () => (
    <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.md)} width="100%">
      <Typography variant="body1" data-testid={DATA_TEST_ID.SUBTITLE}>
        {errorMessage || t("auth.pages.authHandler.errors.linkInvalidOrExpired")}
      </Typography>
      <PrimaryButton
        fullWidth
        showCircle
        onClick={goToLogin}
        color="primary"
        data-testid={DATA_TEST_ID.BACK_TO_LOGIN_BUTTON}
        sx={{
          backgroundColor: theme.palette.tertiary.light,
          color: theme.palette.primary.main,
          alignSelf: "center",
        }}
      >
        {t("common.buttons.backToLogin")}
      </PrimaryButton>
    </Box>
  );

  const renderResetForm = () => (
    <Box
      component="form"
      onSubmit={handleConfirmReset}
      data-testid={DATA_TEST_ID.RESET_FORM}
      display="flex"
      flexDirection="column"
      width="100%"
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      {accountEmail && (
        <Typography variant="body2" data-testid={DATA_TEST_ID.SUBTITLE}>
          {t("auth.pages.authHandler.resetPasswordSubtitle", { email: accountEmail })}
        </Typography>
      )}
      <PasswordInput
        fullWidth
        placeholder={t("auth.pages.authHandler.newPasswordPlaceholder")}
        variant="outlined"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        onValidityChange={setIsPasswordValid}
        sx={outlinedNoBorderSx}
        inputProps={{ "data-testid": DATA_TEST_ID.NEW_PASSWORD_INPUT }}
        disabled={isSubmitting}
        autoFocus
      />
      <TextField
        fullWidth
        placeholder={t("common.fields.confirmPassword")}
        type="password"
        variant="outlined"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        sx={outlinedNoBorderSx}
        inputProps={{ "data-testid": DATA_TEST_ID.CONFIRM_PASSWORD_INPUT }}
        disabled={isSubmitting}
        error={confirmPassword !== "" && confirmPassword !== newPassword}
        helperText={
          confirmPassword !== "" && confirmPassword !== newPassword ? t("common.validation.passwordsDoNotMatch") : ""
        }
      />
      <PrimaryButton
        fullWidth
        type="submit"
        showCircle
        disableWhenOffline={true}
        color="primary"
        disabled={isSubmitting || !isPasswordValid || newPassword !== confirmPassword}
        data-testid={DATA_TEST_ID.SUBMIT_BUTTON}
        sx={{
          backgroundColor: theme.palette.tertiary.light,
          color: theme.palette.primary.main,
          alignSelf: "center",
        }}
      >
        {isSubmitting ? (
          <CircularProgress size={16} color="inherit" aria-label={t("auth.pages.authHandler.savingPassword")} />
        ) : (
          t("auth.pages.authHandler.savePassword")
        )}
      </PrimaryButton>
    </Box>
  );

  const renderSuccess = () => {
    let body: string;
    switch (mode) {
      case "verifyEmail":
        body = t("auth.pages.authHandler.verifyEmailSuccessRedirect");
        break;
      case "recoverEmail":
        body = accountEmail
          ? t("auth.pages.authHandler.recoverEmailSuccessWithEmail", { email: accountEmail })
          : t("auth.pages.authHandler.recoverEmailSuccess");
        break;
      case "resetPassword":
      default:
        body = t("auth.pages.authHandler.passwordResetSuccessFull");
    }
    return (
      <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.md)} width="100%">
        <Typography variant="body1" data-testid={DATA_TEST_ID.SUBTITLE}>
          {body}
        </Typography>
        <PrimaryButton
          showCircle
          color="primary"
          onClick={goToLogin}
          data-testid={DATA_TEST_ID.BACK_TO_LOGIN_BUTTON}
          sx={{
            backgroundColor: theme.palette.tertiary.light,
            color: theme.palette.primary.main,
            alignSelf: "center",
          }}
        >
          {t("common.buttons.backToLogin")}
        </PrimaryButton>
      </Box>
    );
  };

  const title = useMemo(() => {
    if (status === Status.ERROR) return t("auth.pages.authHandler.errors.title");
    switch (mode) {
      case "verifyEmail":
        return t("auth.pages.authHandler.verifyEmailTitle");
      case "recoverEmail":
        return t("auth.pages.authHandler.recoverEmailTitle");
      case "resetPassword":
        return t("auth.pages.authHandler.resetPasswordTitle");
      default:
        return t("auth.pages.authHandler.errors.title");
    }
  }, [mode, status, t]);

  return (
    <Box data-testid={DATA_TEST_ID.AUTH_HANDLER_CONTAINER} sx={{ minHeight: "100%" }}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="space-evenly"
        gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
        width="100%"
        sx={{
          color: theme.palette.common.white,
          "& .MuiTypography-root": { color: theme.palette.common.white },
          "& .MuiLink-root": { color: theme.palette.common.white },
        }}
      >
        <Typography variant="h3" alignSelf="flex-start" textAlign="center" data-testid={DATA_TEST_ID.TITLE}>
          {title}
        </Typography>
        {status === Status.PROCESSING && renderProcessing()}
        {status === Status.AWAITING_INPUT && mode === "resetPassword" && renderResetForm()}
        {status === Status.SUCCESS && renderSuccess()}
        {status === Status.ERROR && renderError()}
      </Box>
    </Box>
  );
};

export default AuthHandler;
