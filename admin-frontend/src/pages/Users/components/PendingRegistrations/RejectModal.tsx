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
  TextField,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { AdminRegistration } from "src/pages/Register/registrationsService";

const uniqueId = "reject-registration-modal-7b9c1d3e-5f4a-2b6d-8e0f-1a2b3c4d5e6f";

export const DATA_TEST_ID = {
  DIALOG: `${uniqueId}-dialog`,
  REASON: `${uniqueId}-reason`,
  CANCEL: `${uniqueId}-cancel`,
  CONFIRM: `${uniqueId}-confirm`,
};

export interface RejectModalProps {
  registration: AdminRegistration | null;
  onClose: () => void;
  onConfirm: (id: string, reason: string) => Promise<void>;
}

const RejectModal: React.FC<RejectModalProps> = ({ registration, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setReason("");
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!registration || !reason.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(registration.id, reason.trim());
      setReason("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("registrations.reject.error", "Failed to reject registration"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!registration} onClose={handleClose} maxWidth="sm" fullWidth data-testid={DATA_TEST_ID.DIALOG}>
      <DialogTitle>{t("registrations.reject.title", "Reject Sign-up")}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText>
          {t(
            "registrations.reject.confirm",
            "Reject the registration for {{email}}. Provide a reason for the audit trail.",
            { email: registration?.email ?? "" }
          )}
        </DialogContentText>
        <TextField
          fullWidth
          margin="normal"
          required
          multiline
          rows={3}
          label={t("registrations.reject.reasonLabel", "Reason")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={loading}
          inputProps={{ maxLength: 500 }}
          data-testid={DATA_TEST_ID.REASON}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading} data-testid={DATA_TEST_ID.CANCEL}>
          {t("common.cancel", "Cancel")}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="error"
          disabled={loading || reason.trim() === ""}
          data-testid={DATA_TEST_ID.CONFIRM}
        >
          {loading ? <CircularProgress size={20} /> : t("registrations.reject.submit", "Reject")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RejectModal;
