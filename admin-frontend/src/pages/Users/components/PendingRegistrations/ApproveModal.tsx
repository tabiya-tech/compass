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

const uniqueId = "approve-registration-modal-1a3c5e7f-2b4d-6e8a-9c0e-1d2f3a4b5c6d";

export const DATA_TEST_ID = {
  DIALOG: `${uniqueId}-dialog`,
  CANCEL: `${uniqueId}-cancel`,
  CONFIRM: `${uniqueId}-confirm`,
};

export interface ApproveModalProps {
  registration: AdminRegistration | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

const ApproveModal: React.FC<ApproveModalProps> = ({ registration, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!registration) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(registration.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("registrations.approve.error", "Failed to approve registration"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!registration} onClose={onClose} maxWidth="sm" fullWidth data-testid={DATA_TEST_ID.DIALOG}>
      <DialogTitle>{t("registrations.approve.title", "Approve Sign-up")}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText>
          {t(
            "registrations.approve.confirm",
            "This will create a Firebase account for {{email}} and email them a password-reset link. Continue?",
            { email: registration?.email ?? "" }
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} data-testid={DATA_TEST_ID.CANCEL}>
          {t("common.cancel", "Cancel")}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="success"
          disabled={loading}
          data-testid={DATA_TEST_ID.CONFIRM}
        >
          {loading ? <CircularProgress size={20} /> : t("registrations.approve.submit", "Approve")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApproveModal;
