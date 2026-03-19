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
import { usersService } from "../usersService";
import { useUsersContext } from "../UsersContext";

const uniqueId = "delete-user-modal-5c7e9f1b-3d4a-6b8c-0e2f-4a6b8c0d2e3f";

export const DATA_TEST_ID = {
  DELETE_USER_MODAL_DIALOG: `${uniqueId}-dialog`,
  DELETE_USER_MODAL_CANCEL: `${uniqueId}-cancel`,
  DELETE_USER_MODAL_CONFIRM: `${uniqueId}-confirm`,
};

const DeleteUserModal: React.FC = () => {
  const { t } = useTranslation();
  const { deleteUser, setDeleteUser, fetchUsers } = useUsersContext();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = deleteUser !== null;

  const handleClose = () => {
    setError(null);
    setDeleteUser(null);
  };

  const handleConfirm = async () => {
    if (!deleteUser) return;
    setError(null);
    setLoading(true);
    try {
      await usersService.deleteUser(deleteUser.uid);
      handleClose();
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("users.error.deleteFailed", "Failed to delete user"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      data-testid={DATA_TEST_ID.DELETE_USER_MODAL_DIALOG}
    >
      <DialogTitle>{t("users.deleteModal.title", "Delete User")}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText>
          {t("users.deleteModal.message", "Are you sure you want to delete {{email}}? This action cannot be undone.", {
            email: deleteUser?.email ?? deleteUser?.uid,
          })}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading} data-testid={DATA_TEST_ID.DELETE_USER_MODAL_CANCEL}>
          {t("common.cancel", "Cancel")}
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleConfirm}
          disabled={loading}
          data-testid={DATA_TEST_ID.DELETE_USER_MODAL_CONFIRM}
        >
          {loading ? <CircularProgress size={20} /> : t("users.deleteModal.confirm", "Delete")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteUserModal;
