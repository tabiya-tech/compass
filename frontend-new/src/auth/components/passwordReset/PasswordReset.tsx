import React, { useCallback, useEffect, useState, useContext } from "react";
import { Box, Typography, Modal, Theme, useTheme, useMediaQuery, TextField, DialogActions } from "@mui/material";
import FirebaseEmailAuthService
  from "src/auth/services/FirebaseAuthenticationService/emailAuth/FirebaseEmailAuthentication.service";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { FirebaseError, getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import CloseIcon from "@mui/icons-material/Close";

const COOLDOWN_SECONDS = 60;

export const DATA_TEST_ID = {
  CONTAINER: "reset-password-email-container",
  RESET_LINK: "reset-password-email-link",
  TIMER: "reset-password-email-timer",
  DIALOG: "reset-password-email-dialog",
  DIALOG_TITLE: "reset-password-email-dialog-title",
  CLOSE_ICON: "reset-password-email-close-icon",
  INPUT: "reset-password-email-input",
  SUBMIT: "reset-password-email-submit",
  CANCEL: "reset-password-email-cancel",
};

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  maxWidth: 400,
  width: "100%",
  backgroundColor: "background.paper",
  boxShadow: 24,
  borderRadius: 1,
  padding: (theme: Theme) => theme.fixedSpacing(theme.tabiyaSpacing.md),
};


interface ResetPasswordEmailSenderProps {
  initialCooldownSeconds?: number;
}

const ResetPasswordEmailSender: React.FC<ResetPasswordEmailSenderProps> = (
  {
   initialCooldownSeconds = 0,
 }) => {
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(initialCooldownSeconds);
  const { enqueueSnackbar } = useSnackbar();
  const isOnline = useContext(IsOnlineContext);

  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldownSeconds > 0) {
      timer = setInterval(() => {
        setCooldownSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleSendResetEmail = useCallback(async () => {
    setIsLoading(true);
    if(!emailInput) {
      enqueueSnackbar("Please enter your email address", { variant: "warning" });
      setIsLoading(false);
      return;
    }
    try {
      const authService = FirebaseEmailAuthService.getInstance();
      await authService.resetPassword(emailInput);
      enqueueSnackbar("Password reset email sent!", { variant: "success" });
      setCooldownSeconds(COOLDOWN_SECONDS);
    } catch (error) {
      const message = error instanceof FirebaseError ? getUserFriendlyFirebaseErrorMessage(error) : (error as Error).message;
      enqueueSnackbar(`Failed to send reset email: ${message}`, { variant: "error" });
    } finally {
      setIsLoading(false);
      setDialogOpen(false);
    }
  }, [emailInput, enqueueSnackbar]);

  return (
    <Box data-testid={DATA_TEST_ID.CONTAINER} sx={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: theme.spacing(1), marginTop: theme.spacing(2),
    }}>
      {(cooldownSeconds !== initialCooldownSeconds) && <Typography variant="body2" color="info">
        A password reset link has been sent to your email address.
      </Typography>}
      <Box>
        <CustomLink
          onClick={() => setDialogOpen(true)}
          disabled={isLoading || cooldownSeconds > 0 || !isOnline}
          data-testid={DATA_TEST_ID.RESET_LINK}
        >
          Forgot password?
        </CustomLink>
        {cooldownSeconds > 0 && (
          <Typography
            variant="caption"
            color="textSecondary"
            component="span"
            sx={{ ml: 1 }}
            data-testid={DATA_TEST_ID.TIMER}
          >
            ({cooldownSeconds}s)
          </Typography>
        )}
      </Box>

      <Modal open={dialogOpen} onClose={() => setDialogOpen(false)} data-testid={DATA_TEST_ID.DIALOG}>
        <Box
          sx={{ ...style, padding: isSmallMobile ? theme.fixedSpacing(theme.tabiyaSpacing.md) : theme.tabiyaSpacing.lg }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="start" sx={{ mb: theme.fixedSpacing(theme.tabiyaSpacing.sm) }}>
            <Typography variant="h4" gutterBottom data-testid={DATA_TEST_ID.DIALOG_TITLE}>
              Reset Password
            </Typography>
            <PrimaryIconButton
              title="Close request invitation code form"
              onClick={() => setDialogOpen(false)}
              sx={{
                color: theme.palette.grey[500],
              }}
              data-testid={DATA_TEST_ID.CLOSE_ICON}
            >
              <CloseIcon />
            </PrimaryIconButton>
          </Box>
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            autoFocus
            data-testid={DATA_TEST_ID.INPUT}
          />
          <DialogActions>
            <PrimaryButton
              type="submit"
              disableWhenOffline={true}
              fullWidth
              disabled={!emailInput || isLoading}
              data-testid={DATA_TEST_ID.SUBMIT}
              onClick={handleSendResetEmail}
            >
              Submit
            </PrimaryButton>
          </DialogActions>
        </Box>
      </Modal>
    </Box>
  )};

export default ResetPasswordEmailSender;
