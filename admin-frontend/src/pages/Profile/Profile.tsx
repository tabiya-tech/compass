import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import firebase from "firebase/compat/app";
import { firebaseAuth } from "src/auth/firebaseConfig";
import Header from "src/components/Header/Header";
import Footer from "src/components/Footer/Footer";
import UserStateService from "src/userState/UserStateService";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { usersService, HttpError } from "src/pages/Users/usersService";

const uniqueId = "profile-page-a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export const DATA_TEST_ID = {
  PROFILE_PAGE_CONTAINER: `${uniqueId}-container`,
  PROFILE_NAME_INPUT: `${uniqueId}-name`,
  PROFILE_EMAIL_INPUT: `${uniqueId}-email`,
  PROFILE_SAVE_BUTTON: `${uniqueId}-save`,
  PROFILE_CURRENT_PASSWORD_INPUT: `${uniqueId}-current-password`,
  PROFILE_NEW_PASSWORD_INPUT: `${uniqueId}-new-password`,
  PROFILE_CONFIRM_PASSWORD_INPUT: `${uniqueId}-confirm-password`,
  PROFILE_CHANGE_PASSWORD_BUTTON: `${uniqueId}-change-password`,
};

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const userStateService = UserStateService.getInstance();

  const [name, setName] = useState(userStateService.getUserName() ?? "");
  const [email, setEmail] = useState(userStateService.getUserEmail() ?? "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleProfileSave = async () => {
    setProfileError(null);
    setProfileSuccess(false);

    const userId = userStateService.getUserId();
    if (!userId) {
      setProfileError(t("profile.error.noUser"));
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) {
      setProfileError(t("profile.error.nameEmailRequired"));
      return;
    }

    setProfileLoading(true);
    try {
      const response = await usersService.updateProfile(userId, {
        name: trimmedName,
        email: trimmedEmail,
      });

      userStateService.setUserState({
        ...userStateService.getUserState()!,
        name: response.name ?? trimmedName,
        email: response.email ?? trimmedEmail,
      });

      const authStateService = AuthenticationStateService.getInstance();
      const currentUser = authStateService.getUser();
      if (currentUser) {
        authStateService.setUser({
          ...currentUser,
          name: response.name ?? trimmedName,
          email: response.email ?? trimmedEmail,
        });
      }

      setProfileSuccess(true);
    } catch (err: unknown) {
      if (err instanceof HttpError && err.status === 409) {
        setProfileError(t("profile.error.emailAlreadyExists"));
      } else {
        setProfileError(err instanceof Error ? err.message : t("profile.error.saveFailed"));
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword) {
      setPasswordError(t("profile.error.currentPasswordRequired"));
      return;
    }
    if (!newPassword) {
      setPasswordError(t("profile.error.newPasswordRequired"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.error.passwordMismatch"));
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError(t("profile.error.passwordTooShort"));
      return;
    }

    setPasswordLoading(true);
    try {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error(t("profile.error.noUser"));
      }

      const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPassword);
      await currentUser.reauthenticateWithCredential(credential);
      await currentUser.updatePassword(newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr?.code === "auth/wrong-password" || firebaseErr?.code === "auth/invalid-credential") {
        setPasswordError(t("profile.error.wrongPassword"));
      } else if (firebaseErr?.code === "auth/requires-recent-login") {
        setPasswordError(t("profile.error.requiresRecentLogin"));
      } else {
        setPasswordError(firebaseErr?.message ?? t("profile.error.passwordChangeFailed"));
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const isProfileChanged =
    name.trim() !== (userStateService.getUserName() ?? "") || email.trim() !== (userStateService.getUserEmail() ?? "");

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: theme.palette.pageBackground.light,
      }}
      data-testid={DATA_TEST_ID.PROFILE_PAGE_CONTAINER}
    >
      <Header />

      <Container maxWidth="sm" sx={{ py: theme.fixedSpacing(theme.tabiyaSpacing.xl) }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}>
          {t("profile.title")}
        </Typography>

        {/* Profile Information */}
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            borderRadius: theme.tabiyaRounding.sm,
            p: theme.fixedSpacing(theme.tabiyaSpacing.lg),
            mb: theme.fixedSpacing(theme.tabiyaSpacing.lg),
          }}
        >
          <Typography variant="h6" sx={{ mb: theme.fixedSpacing(theme.tabiyaSpacing.md) }}>
            {t("profile.section.profileInfo")}
          </Typography>

          {profileError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setProfileError(null)}>
              {profileError}
            </Alert>
          )}
          {profileSuccess && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setProfileSuccess(false)}>
              {t("profile.success.profileUpdated")}
            </Alert>
          )}

          <TextField
            label={t("profile.field.name")}
            fullWidth
            margin="normal"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setProfileSuccess(false);
            }}
            disabled={profileLoading}
            data-testid={DATA_TEST_ID.PROFILE_NAME_INPUT}
          />
          <TextField
            label={t("profile.field.email")}
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setProfileSuccess(false);
            }}
            disabled={profileLoading}
            data-testid={DATA_TEST_ID.PROFILE_EMAIL_INPUT}
          />

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: theme.fixedSpacing(theme.tabiyaSpacing.md) }}>
            <Button
              variant="contained"
              onClick={handleProfileSave}
              disabled={profileLoading || !isProfileChanged}
              data-testid={DATA_TEST_ID.PROFILE_SAVE_BUTTON}
            >
              {profileLoading ? <CircularProgress size={20} /> : t("profile.action.save")}
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: theme.fixedSpacing(theme.tabiyaSpacing.lg) }} />

        {/* Change Password */}
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            borderRadius: theme.tabiyaRounding.sm,
            p: theme.fixedSpacing(theme.tabiyaSpacing.lg),
          }}
        >
          <Typography variant="h6" sx={{ mb: theme.fixedSpacing(theme.tabiyaSpacing.md) }}>
            {t("profile.section.changePassword")}
          </Typography>

          {passwordError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPasswordError(null)}>
              {passwordError}
            </Alert>
          )}
          {passwordSuccess && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setPasswordSuccess(false)}>
              {t("profile.success.passwordChanged")}
            </Alert>
          )}

          <TextField
            label={t("profile.field.currentPassword")}
            type="password"
            fullWidth
            margin="normal"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setPasswordSuccess(false);
            }}
            disabled={passwordLoading}
            data-testid={DATA_TEST_ID.PROFILE_CURRENT_PASSWORD_INPUT}
          />
          <TextField
            label={t("profile.field.newPassword")}
            type="password"
            fullWidth
            margin="normal"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPasswordSuccess(false);
            }}
            disabled={passwordLoading}
            data-testid={DATA_TEST_ID.PROFILE_NEW_PASSWORD_INPUT}
          />
          <TextField
            label={t("profile.field.confirmPassword")}
            type="password"
            fullWidth
            margin="normal"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPasswordSuccess(false);
            }}
            disabled={passwordLoading}
            data-testid={DATA_TEST_ID.PROFILE_CONFIRM_PASSWORD_INPUT}
          />

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: theme.fixedSpacing(theme.tabiyaSpacing.md) }}>
            <Button
              variant="contained"
              onClick={handlePasswordChange}
              disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
              data-testid={DATA_TEST_ID.PROFILE_CHANGE_PASSWORD_BUTTON}
            >
              {passwordLoading ? <CircularProgress size={20} /> : t("profile.action.changePassword")}
            </Button>
          </Box>
        </Box>
      </Container>

      <Footer />
    </Box>
  );
};

export default Profile;
