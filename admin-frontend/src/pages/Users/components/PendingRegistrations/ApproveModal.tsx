import React, { useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { AdminRegistration } from "src/pages/Register/registrationsService";
import { EmailSendError } from "./usePendingRegistrations";

const uniqueId = "approve-registration-modal-1a3c5e7f-2b4d-6e8a-9c0e-1d2f3a4b5c6d";

export const DATA_TEST_ID = {
  DIALOG: `${uniqueId}-dialog`,
  CANCEL: `${uniqueId}-cancel`,
  CONFIRM: `${uniqueId}-confirm`,
  EMAIL_FAILED_ALERT: `${uniqueId}-email-failed-alert`,
  RESEND: `${uniqueId}-resend`,
  CLOSE: `${uniqueId}-close`,
};

export interface ApproveModalProps {
  registration: AdminRegistration | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
  onResendEmail: (email: string) => Promise<void>;
}

const ApproveModal: React.FC<ApproveModalProps> = ({ registration, onClose, onConfirm, onResendEmail }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFailedFor, setEmailFailedFor] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const handleClose = () => {
    setError(null);
    setEmailFailedFor(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!registration) return;
    setLoading(true);
    setError(null);
    setEmailFailedFor(null);
    try {
      await onConfirm(registration.id);
      handleClose();
    } catch (e) {
      if (e instanceof EmailSendError) {
        // Approval succeeded server-side; only the email send failed.
        // Keep the dialog open with a Resend prompt.
        setEmailFailedFor(e.email);
      } else {
        setError(e instanceof Error ? e.message : t("registrations.approve.error"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!emailFailedFor) return;
    setResending(true);
    try {
      await onResendEmail(emailFailedFor);
      handleClose();
    } catch {
      // Stay open; the alert remains visible so the user can retry.
    } finally {
      setResending(false);
    }
  };

  const showingResendState = emailFailedFor !== null;

  return (
    <Dialog open={!!registration} onClose={handleClose} maxWidth="sm" fullWidth data-testid={DATA_TEST_ID.DIALOG}>
      <DialogTitle>{t("registrations.approve.title")}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {showingResendState ? (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid={DATA_TEST_ID.EMAIL_FAILED_ALERT}>
            {t(
              "registrations.approve.emailFailed",
              "Approved {{email}}, but the password-reset email failed to send. You can retry now or send it later from the Forgot Password page.",
              { email: emailFailedFor }
            )}
          </Alert>
        ) : (
          <DialogContentText>
            {t(
              "registrations.approve.confirm",
              "This will create a Firebase account for {{email}} and email them a password-reset link. Continue?",
              { email: registration?.email ?? "" }
            )}
          </DialogContentText>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {showingResendState ? (
          <>
            <Button onClick={handleClose} disabled={resending} data-testid={DATA_TEST_ID.CLOSE}>
              {t("common.close")}
            </Button>
            <Button
              onClick={handleResend}
              variant="contained"
              color="warning"
              disabled={resending}
              data-testid={DATA_TEST_ID.RESEND}
            >
              {resending ? <CircularProgress size={20} /> : t("registrations.approve.resend")}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleClose} disabled={loading} data-testid={DATA_TEST_ID.CANCEL}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleConfirm}
              variant="contained"
              color="success"
              disabled={loading}
              data-testid={DATA_TEST_ID.CONFIRM}
            >
              {loading ? <CircularProgress size={20} /> : t("registrations.approve.submit")}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ApproveModal;
