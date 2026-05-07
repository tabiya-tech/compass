import React, { useState } from "react";
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
  TextField,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { usersService, Role, CreateUserRequest, HttpError } from "../usersService";
import { useUsersContext } from "../UsersContext";
import InstitutionAutocomplete, { useInstitutionOptions } from "./InstitutionAutocomplete";
import UserStateService from "src/userState/UserStateService";

const uniqueId = "create-user-modal-3a5c7e9f-1b2d-4f6a-8c0e-2d4f6a8b0c1e";

export const DATA_TEST_ID = {
  CREATE_USER_MODAL_DIALOG: `${uniqueId}-dialog`,
  CREATE_USER_MODAL_EMAIL: `${uniqueId}-email`,
  CREATE_USER_MODAL_NAME: `${uniqueId}-name`,
  CREATE_USER_MODAL_ROLE: `${uniqueId}-role`,
  CREATE_USER_MODAL_INSTITUTION_ID: `${uniqueId}-institution-id`,
  CREATE_USER_MODAL_CANCEL: `${uniqueId}-cancel`,
  CREATE_USER_MODAL_SUBMIT: `${uniqueId}-submit`,
};

const ROLE_LABELS: Record<string, string> = {
  [Role.SUPER_ADMIN]: "Super Admin",
  [Role.ADMIN]: "Admin",
  [Role.INSTITUTION_STAFF]: "Institution Staff",
};

const CreateUserModal: React.FC = () => {
  const { t } = useTranslation();
  const { createModalOpen, setCreateModalOpen, fetchUsers } = useUsersContext();
  const {
    options: institutionOptions,
    loading: institutionsLoading,
    error: institutionsError,
  } = useInstitutionOptions();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>(Role.ADMIN);
  const [institutionId, setInstitutionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const isSuperAdmin = UserStateService.getInstance().isSuperAdmin();

  const handleClose = () => {
    setEmail("");
    setName("");
    setRole(Role.ADMIN);
    setInstitutionId("");
    setError(null);
    setEmailError(null);
    setCreateModalOpen(false);
  };

  const handleSubmit = async () => {
    setError(null);
    setEmailError(null);
    const request: CreateUserRequest = {
      email,
      name,
      role,
      ...(role === Role.INSTITUTION_STAFF && institutionId ? { institution_id: institutionId } : {}),
    };
    setLoading(true);
    try {
      await usersService.createUser(request);
      handleClose();
      fetchUsers();
    } catch (err: unknown) {
      if (err instanceof HttpError && err.status === 409) {
        setEmailError(t("users.error.emailAlreadyExists", "A user with this email already exists"));
      } else {
        setError(err instanceof Error ? err.message : t("users.error.createFailed", "Failed to create user"));
      }
    } finally {
      setLoading(false);
    }
  };

  const isValid =
    email.trim() !== "" && name.trim() !== "" && (role !== Role.INSTITUTION_STAFF || institutionId.trim() !== "");

  return (
    <Dialog
      open={createModalOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      data-testid={DATA_TEST_ID.CREATE_USER_MODAL_DIALOG}
    >
      <DialogTitle>{t("users.createModal.title", "Add New User")}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          label={t("users.createModal.email", "Email")}
          type="email"
          fullWidth
          margin="normal"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError(null);
          }}
          required
          disabled={loading}
          error={!!emailError}
          helperText={emailError}
          data-testid={DATA_TEST_ID.CREATE_USER_MODAL_EMAIL}
        />
        <TextField
          label={t("users.createModal.name", "Display Name")}
          fullWidth
          margin="normal"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={loading}
          data-testid={DATA_TEST_ID.CREATE_USER_MODAL_NAME}
        />
        <FormControl fullWidth margin="normal" required>
          <InputLabel>{t("users.createModal.role", "Role")}</InputLabel>
          <Select
            value={role}
            label={t("users.createModal.role", "Role")}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={loading}
            data-testid={DATA_TEST_ID.CREATE_USER_MODAL_ROLE}
          >
            {isSuperAdmin && <MenuItem value={Role.SUPER_ADMIN}>{ROLE_LABELS[Role.SUPER_ADMIN]}</MenuItem>}
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
        <Button onClick={handleClose} disabled={loading} data-testid={DATA_TEST_ID.CREATE_USER_MODAL_CANCEL}>
          {t("common.cancel", "Cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !isValid}
          data-testid={DATA_TEST_ID.CREATE_USER_MODAL_SUBMIT}
        >
          {loading ? <CircularProgress size={20} /> : t("users.createModal.submit", "Create User")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateUserModal;
