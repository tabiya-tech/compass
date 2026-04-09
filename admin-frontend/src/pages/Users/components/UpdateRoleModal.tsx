import React, { useState, useEffect } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { usersService, Role, UpdateRoleRequest } from "../usersService";
import { useUsersContext } from "../UsersContext";
import InstitutionAutocomplete, { useInstitutionOptions } from "./InstitutionAutocomplete";

const uniqueId = "update-role-modal-4b6d8e0a-2c3f-5a7b-9d1e-3f5a7b9c0d2e";

export const DATA_TEST_ID = {
  UPDATE_ROLE_MODAL_DIALOG: `${uniqueId}-dialog`,
  UPDATE_ROLE_MODAL_ROLE: `${uniqueId}-role`,
  UPDATE_ROLE_MODAL_INSTITUTION_ID: `${uniqueId}-institution-id`,
  UPDATE_ROLE_MODAL_CANCEL: `${uniqueId}-cancel`,
  UPDATE_ROLE_MODAL_SUBMIT: `${uniqueId}-submit`,
};

const ROLE_LABELS: Record<string, string> = {
  [Role.ADMIN]: "Admin",
  [Role.INSTITUTION_STAFF]: "Institution Staff",
};

const UpdateRoleModal: React.FC = () => {
  const { t } = useTranslation();
  const { updateUser, setUpdateUser, fetchUsers } = useUsersContext();
  const { options: institutionOptions, loading: institutionsLoading, error: institutionsError } = useInstitutionOptions();

  const [role, setRole] = useState<Role>(Role.ADMIN);
  const [institutionId, setInstitutionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = updateUser !== null;

  useEffect(() => {
    if (updateUser) {
      setRole((updateUser.role as Role) ?? Role.ADMIN);
      setInstitutionId(updateUser.institution_id ?? "");
      setError(null);
    }
  }, [updateUser]);

  const handleClose = () => {
    setError(null);
    setUpdateUser(null);
  };

  const handleSubmit = async () => {
    if (!updateUser) return;
    setError(null);
    const request: UpdateRoleRequest = {
      role,
      ...(role === Role.INSTITUTION_STAFF && institutionId ? { institution_id: institutionId } : {}),
    };
    setLoading(true);
    try {
      await usersService.updateRole(updateUser.uid, request);
      handleClose();
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("users.error.updateFailed", "Failed to update role"));
    } finally {
      setLoading(false);
    }
  };

  const isValid = role !== Role.INSTITUTION_STAFF || institutionId.trim() !== "";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      data-testid={DATA_TEST_ID.UPDATE_ROLE_MODAL_DIALOG}
    >
      <DialogTitle>{t("users.updateRoleModal.title", "Update Role")}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {updateUser?.email}
        </Typography>
        <FormControl fullWidth margin="normal" required>
          <InputLabel>{t("users.updateRoleModal.role", "Role")}</InputLabel>
          <Select
            value={role}
            label={t("users.updateRoleModal.role", "Role")}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={loading}
            data-testid={DATA_TEST_ID.UPDATE_ROLE_MODAL_ROLE}
          >
            <MenuItem value={Role.ADMIN}>{ROLE_LABELS[Role.ADMIN]}</MenuItem>
            <MenuItem value={Role.INSTITUTION_STAFF}>{ROLE_LABELS[Role.INSTITUTION_STAFF]}</MenuItem>
          </Select>
        </FormControl>
        {role === Role.INSTITUTION_STAFF && (
          <InstitutionAutocomplete
            value={institutionId}
            onChange={setInstitutionId}
            required
            disabled={loading}
            options={institutionOptions}
            loading={institutionsLoading}
            error={institutionsError}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading} data-testid={DATA_TEST_ID.UPDATE_ROLE_MODAL_CANCEL}>
          {t("common.cancel", "Cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !isValid}
          data-testid={DATA_TEST_ID.UPDATE_ROLE_MODAL_SUBMIT}
        >
          {loading ? <CircularProgress size={20} /> : t("users.updateRoleModal.submit", "Update Role")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateRoleModal;
