import React, { useCallback, useContext, useState } from "react";
import "firebaseui/dist/firebaseui.css";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { TabiyaUser } from "src/auth/auth.types";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { Box, Button, Typography } from "@mui/material";
import { socialAuthService } from "src/auth/services/socialAuth/SocialAuth.service";
import { AuthContext } from "src/auth/AuthProvider";
import { getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { writeFirebaseErrorToLog } from "src/error/FirebaseError/logger";
import { GoogleIcon } from "src/theme/Icons/GoogleIcon";

const uniqueId = "f0324e97-83fd-49e6-95c3-1043751fa1db";
export const DATA_TEST_ID = {
  FIREBASE_AUTH: `firebase-auth-${uniqueId}`,
  FIREBASE_FALLBACK_TEXT: `firebase-fallback-text-${uniqueId}`,
  FIREBASE_AUTH_CONTAINER: `firebase-auth-container-${uniqueId}`,
  CONTINUE_WITH_GOOGLE: `continue-with-google-${uniqueId}`,
  CONTINUE_WITH_GOOGLE_BUTTON: `continue-with-google-button-${uniqueId}`,
};

export interface SocialAuthProps {
  preLoginCheck?: () => Promise<boolean> | boolean;
  disabled?: boolean;
  label?: string;
  postLoginHandler: (user: TabiyaUser) => void;
  isLoading: boolean;
}

const SocialAuth: React.FC<Readonly<SocialAuthProps>> = ({
  preLoginCheck,
  disabled = false,
  label,
  postLoginHandler,
  isLoading,
}) => {
  const isOnline = useContext(IsOnlineContext);
  const { isAuthenticationInProgress, updateUserByToken } = useContext(AuthContext);

  const { enqueueSnackbar } = useSnackbar();
  const [loginInProgress, setLoginInProgress] = useState(false);

  const [error, setError] = useState("");

  const loginWithPopup = useCallback(async () => {
    try {
      setLoginInProgress(true);
      // If preLoginCheck is provided, run it and only proceed if it returns true
      // Pre login check is mostly used to check if the user has a valid code.
      // NOTE: a default function that returns true should be added otherwise users will not be able to login using social auth
      const passed = await preLoginCheck?.();

      if (!passed) {
        setLoginInProgress(false);
        return;
      }

      await socialAuthService.handleLoginWithGoogle(
        (token) => {
          const _user = updateUserByToken(token);
          if (_user) {
            postLoginHandler(_user);
          }
        },
        (error) => {
          const shownError = getUserFriendlyFirebaseErrorMessage(error);
          writeFirebaseErrorToLog(error, console.error);
          enqueueSnackbar(shownError, { variant: "error" });
          setError(shownError);
        }
      );
      return false;  //TODO: why is this here?
    } catch (error: any) {
      console.log(error);
      enqueueSnackbar("Login failed", { variant: "error" });
      setError(error.message);
    } finally {
      setLoginInProgress(false);
    }
  }, [enqueueSnackbar, postLoginHandler, preLoginCheck, updateUserByToken]);

  const socialAuthLoading = isLoading || isAuthenticationInProgress || loginInProgress || !isOnline || disabled;

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      mt={(theme) => theme.tabiyaSpacing.lg}
      data-testid={DATA_TEST_ID.FIREBASE_AUTH_CONTAINER}
    >
      <Typography variant="caption" mt={2} data-testid={DATA_TEST_ID.CONTINUE_WITH_GOOGLE}>
        Or continue with
      </Typography>
      <Box mt={2} width="100%">
        <div data-test_id={DATA_TEST_ID.FIREBASE_AUTH}>
          {error && (
            <Typography
              variant="subtitle2"
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                color: (theme) => theme.palette.error.main,
              }}
            >
              {error}
            </Typography>
          )}
          <Button
            variant="text"
            size={"medium"}
            disabled={socialAuthLoading}
            fullWidth
            id={"firebaseui-auth-container"}
            data-testid={DATA_TEST_ID.CONTINUE_WITH_GOOGLE_BUTTON}
            onClick={loginWithPopup}
            sx={{
              paddingX: 4,
              display: "flex",
              justifyItems: "center",
              alignContent: "center",
              gap: 2,
              color: (theme) => theme.palette.tabiyaBlue.light,
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <GoogleIcon disabled={socialAuthLoading} />
            </div>
            <Typography variant="body2">{label ?? "Sign in with Google"}</Typography>
          </Button>
          {!isOnline && (
            <Typography
              variant="subtitle2"
              sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
              data-testid={DATA_TEST_ID.FIREBASE_FALLBACK_TEXT}
            >
              Google sign in is not available when offline.
            </Typography>
          )}
        </div>
      </Box>
    </Box>
  );
};

export default React.memo(SocialAuth);
