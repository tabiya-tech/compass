import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useTranslation } from "react-i18next";
import { AdminRegistration } from "src/pages/Register/registrationsService";

const uniqueId = "approve-registration-modal-1a3c5e7f-2b4d-6e8a-9c0e-1d2f3a4b5c6d";

export const DATA_TEST_ID = {
  DIALOG: `${uniqueId}-dialog`,
  CANCEL: `${uniqueId}-cancel`,
  CONFIRM: `${uniqueId}-confirm`,
  RESET_LINK: `${uniqueId}-reset-link`,
  COPY_LINK: `${uniqueId}-copy-link`,
  CLOSE: `${uniqueId}-close`,
};

export interface ApproveModalProps {
  registration: AdminRegistration | null;
  onClose: () => void;
  /** Returns the password reset link for the newly created user. */
  onConfirm: (id: string) => Promise<string>;
}

const ApproveModal: React.FC<ApproveModalProps> = ({ registration, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    setError(null);
    setResetLink(null);
    setCopied(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (!registration) return;
    setLoading(true);
    setError(null);
    try {
      const link = await onConfirm(registration.id);
      setResetLink(link);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("registrations.approve.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!resetLink) return;
    await navigator.clipboard.writeText(resetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showingLinkState = resetLink !== null;

  return (
    <Dialog open={!!registration} onClose={handleClose} maxWidth="sm" fullWidth data-testid={DATA_TEST_ID.DIALOG}>
      <DialogTitle>{t("registrations.approve.title")}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {showingLinkState ? (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              {t("registrations.approve.approved", { email: registration?.email ?? "" })}
            </Alert>
            <TextField
              label={t("registrations.approve.resetLinkLabel")}
              value={resetLink}
              fullWidth
              multiline
              maxRows={4}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={copied ? t("common.copied") : t("common.copy")}>
                      <IconButton onClick={handleCopy} edge="end" data-testid={DATA_TEST_ID.COPY_LINK}>
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              data-testid={DATA_TEST_ID.RESET_LINK}
            />
            <Box sx={{ mt: 1 }}>
              <Alert severity="info">{t("registrations.approve.resetLinkInfo")}</Alert>
            </Box>
          </>
        ) : (
          <DialogContentText>
            {t("registrations.approve.confirm", { email: registration?.email ?? "" })}
          </DialogContentText>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {showingLinkState ? (
          <Button onClick={handleClose} data-testid={DATA_TEST_ID.CLOSE}>
            {t("common.close")}
          </Button>
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
