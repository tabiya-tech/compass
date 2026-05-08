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
import FirebaseEmailAuthenticationService from "src/auth/services/FirebaseAuthenticationService/FirebaseEmailAuthenticationService";

const uniqueId = "create-user-modal-3a5c7e9f-1b2d-4f6a-8c0e-2d4f6a8b0c1e";

export const DATA_TEST_ID = {
  CREATE_USER_MODAL_DIALOG: `${uniqueId}-dialog`,
  CREATE_USER_MODAL_EMAIL: `${uniqueId}-email`,
  CREATE_USER_MODAL_NAME: `${uniqueId}-name`,
  CREATE_USER_MODAL_ROLE: `${uniqueId}-role`,
  CREATE_USER_MODAL_INSTITUTION_ID: `${uniqueId}-institution-id`,
  CREATE_USER_MODAL_CANCEL: `${uniqueId}-cancel`,
  CREATE_USER_MODAL_SUBMIT: `${uniqueId}-submit`,
  CREATE_USER_MODAL_EMAIL_FAILED_ALERT: `${uniqueId}-email-failed-alert`,
  CREATE_USER_MODAL_RESEND: `${uniqueId}-resend`,
  CREATE_USER_MODAL_CLOSE: `${uniqueId}-close`,
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
  const [emailFailedFor, setEmailFailedFor] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const isSuperAdmin = UserStateService.getInstance().isSuperAdmin();

  const handleClose = () => {
    setEmail("");
    setName("");
    setRole(Role.ADMIN);
    setInstitutionId("");
    setError(null);
    setEmailError(null);
    setEmailFailedFor(null);
    setCreateModalOpen(false);
  };

  const handleSubmit = async () => {
    setError(null);
    setEmailError(null);
    setEmailFailedFor(null);
    const request: CreateUserRequest = {
      email,
      name,
      role,
      ...(role === Role.INSTITUTION_STAFF && institutionId ? { institution_id: institutionId } : {}),
    };
    setLoading(true);
    try {
      const created = await usersService.createUser(request);
      fetchUsers();
      // Backend committed the user; trigger Firebase's hosted email template.
      // If the send fails, keep the dialog open with a Resend prompt.
      try {
        await FirebaseEmailAuthenticationService.getInstance().resetPassword(created.email);
        handleClose();
      } catch {
        setEmailFailedFor(created.email);
      }
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

  const handleResend = async () => {
    if (!emailFailedFor) return;
    setResending(true);
    try {
      await FirebaseEmailAuthenticationService.getInstance().resetPassword(emailFailedFor);
      handleClose();
    } catch {
      // Stay open; the alert remains visible so the user can retry.
    } finally {
      setResending(false);
    }
  };

  const isValid =
    email.trim() !== "" && name.trim() !== "" && (role !== Role.INSTITUTION_STAFF || institutionId.trim() !== "");

  const showingResendState = emailFailedFor !== null;

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
        {showingResendState ? (
          <Alert severity="warning" sx={{ mb: 2 }} data-testid={DATA_TEST_ID.CREATE_USER_MODAL_EMAIL_FAILED_ALERT}>
            {t(
              "users.createModal.emailFailed",
              "Created {{email}}, but the password-reset email failed to send. You can retry now or send it later from the Forgot Password page.",
              { email: emailFailedFor }
            )}
          </Alert>
        ) : (
          <>
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
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {showingResendState ? (
          <>
            <Button onClick={handleClose} disabled={resending} data-testid={DATA_TEST_ID.CREATE_USER_MODAL_CLOSE}>
              {t("common.close", "Close")}
            </Button>
            <Button
              onClick={handleResend}
              variant="contained"
              color="warning"
              disabled={resending}
              data-testid={DATA_TEST_ID.CREATE_USER_MODAL_RESEND}
            >
              {resending ? <CircularProgress size={20} /> : t("users.createModal.resend", "Resend email")}
            </Button>
          </>
        ) : (
          <>
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
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CreateUserModal;
