import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
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
  CREATE_USER_MODAL_RESET_LINK: `${uniqueId}-reset-link`,
  CREATE_USER_MODAL_COPY_LINK: `${uniqueId}-copy-link`,
  CREATE_USER_MODAL_CLOSE: `${uniqueId}-close`,
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
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isSuperAdmin = UserStateService.getInstance().isSuperAdmin();

  const handleClose = () => {
    setEmail("");
    setName("");
    setRole(Role.ADMIN);
    setInstitutionId("");
    setError(null);
    setEmailError(null);
    setResetLink(null);
    setCopied(false);
    setCreateModalOpen(false);
  };

  const handleSubmit = async () => {
    setError(null);
    setEmailError(null);
    setResetLink(null);
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
      const { reset_link } = await usersService.getPasswordResetLink(created.uid);
      setResetLink(reset_link);
    } catch (err: unknown) {
      if (err instanceof HttpError && err.status === 409) {
        setEmailError(t("users.error.emailAlreadyExists"));
      } else {
        setError(err instanceof Error ? err.message : t("users.error.createFailed"));
      }
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

  const isValid =
    email.trim() !== "" && name.trim() !== "" && (role !== Role.INSTITUTION_STAFF || institutionId.trim() !== "");

  const showingLinkState = resetLink !== null;

  return (
    <Dialog
      open={createModalOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      data-testid={DATA_TEST_ID.CREATE_USER_MODAL_DIALOG}
    >
      <DialogTitle>{t("users.createModal.title")}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {showingLinkState ? (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              {t("users.createModal.userCreated", { email })}
            </Alert>
            <TextField
              label={t("users.createModal.resetLinkLabel")}
              value={resetLink}
              fullWidth
              multiline
              maxRows={4}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={copied ? t("common.copied") : t("common.copy")}>
                      <IconButton
                        onClick={handleCopy}
                        edge="end"
                        data-testid={DATA_TEST_ID.CREATE_USER_MODAL_COPY_LINK}
                      >
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              data-testid={DATA_TEST_ID.CREATE_USER_MODAL_RESET_LINK}
            />
            <Box sx={{ mt: 1 }}>
              <Alert severity="info">{t("users.createModal.resetLinkInfo")}</Alert>
            </Box>
          </>
        ) : (
          <>
            <TextField
              label={t("users.createModal.email")}
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
              label={t("users.createModal.name")}
              fullWidth
              margin="normal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              data-testid={DATA_TEST_ID.CREATE_USER_MODAL_NAME}
            />
            <FormControl fullWidth margin="normal" required>
              <InputLabel>{t("users.createModal.role")}</InputLabel>
              <Select
                value={role}
                label={t("users.createModal.role")}
                onChange={(e) => setRole(e.target.value as Role)}
                disabled={loading}
                data-testid={DATA_TEST_ID.CREATE_USER_MODAL_ROLE}
              >
                {isSuperAdmin && <MenuItem value={Role.SUPER_ADMIN}>{t("users.roles.superAdmin")}</MenuItem>}
                <MenuItem value={Role.ADMIN}>{t("users.roles.admin")}</MenuItem>
                <MenuItem value={Role.INSTITUTION_STAFF}>{t("users.roles.institutionStaff")}</MenuItem>
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
        {showingLinkState ? (
          <Button onClick={handleClose} data-testid={DATA_TEST_ID.CREATE_USER_MODAL_CLOSE}>
            {t("common.close")}
          </Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={loading} data-testid={DATA_TEST_ID.CREATE_USER_MODAL_CANCEL}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading || !isValid}
              data-testid={DATA_TEST_ID.CREATE_USER_MODAL_SUBMIT}
            >
              {loading ? <CircularProgress size={20} /> : t("users.createModal.submit")}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CreateUserModal;
