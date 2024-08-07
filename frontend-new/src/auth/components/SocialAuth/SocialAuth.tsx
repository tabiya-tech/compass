import React, { useContext, useEffect, useRef, useState } from "react";
import "firebaseui/dist/firebaseui.css";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { TabiyaUser } from "src/auth/auth.types";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { socialAuthService } from "src/auth/services/socialAuth/SocialAuth.service";
import { AuthContext } from "src/auth/AuthProvider";
import FirebaseUIWrapper from "./components/FirebaseUIWrapper";
import { getUserFriendlyFirebaseErrorMessage } from "src/error/FirebaseError/firebaseError";
import { writeFirebaseErrorToLog } from "src/error/FirebaseError/logger";

const uniqueId = "f0324e97-83fd-49e6-95c3-1043751fa1db";
export const DATA_TEST_ID = {
  FIREBASE_AUTH: `firebase-auth-${uniqueId}`,
  FIREBASE_FALLBACK_TEXT: `firebase-fallback-text-${uniqueId}`,
  FIREBASE_AUTH_CONTAINER: `firebase-auth-container-${uniqueId}`,
  CONTINUE_WITH_GOOGLE: `continue-with-google-${uniqueId}`,
  FIREBASE_AUTH_LOADING: `firebase-auth-loading=${uniqueId}`,
};

export interface SocialAuthProps {
  postLoginHandler: (user: TabiyaUser) => void;
  isLoading: boolean;
}

const SocialAuth: React.FC<Readonly<SocialAuthProps>> = ({ postLoginHandler, isLoading }) => {
  const theme = useTheme();
  const { isAuthenticationInProgress, updateUserByToken } = useContext(AuthContext);
  const isOnline = useContext(IsOnlineContext);

  const { enqueueSnackbar } = useSnackbar();

  const [error, setError] = useState("");
  const firebaseUIElementRef = useRef(null);

  useEffect(() => {
    // initialize the firebase UI
    socialAuthService.initializeFirebaseUI(
      firebaseUIElementRef,
      (data) => {
        if (data) {
          const _user = updateUserByToken(data);
          if (_user) {
            postLoginHandler(_user);
          }
        }
      },
      (error) => {
        const shownError = getUserFriendlyFirebaseErrorMessage(error);
        writeFirebaseErrorToLog(error, console.error);
        enqueueSnackbar(shownError, { variant: "error" });
        setError(shownError);
      }
    );
  }, [isOnline, enqueueSnackbar, firebaseUIElementRef, postLoginHandler, updateUserByToken]);

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
          {(isAuthenticationInProgress || isLoading) && (
            <CircularProgress
              color={"secondary"}
              data-testid={DATA_TEST_ID.FIREBASE_AUTH_LOADING}
              aria-label={"Logging in"}
              size={16}
              sx={{ marginTop: theme.tabiyaSpacing.sm, marginBottom: theme.tabiyaSpacing.sm }}
            />
          )}
          {error && (
            <Typography variant="caption" sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {error}
            </Typography>
          )}
          <Box
            sx={{
              pointerEvents: !isOnline ? "none" : "auto",
              opacity: !isOnline ? 0.5 : 1,
            }}
            aria-disabled={!isOnline}
          >
            <FirebaseUIWrapper ref={firebaseUIElementRef} />
          </Box>
          {!isOnline && (
            <Typography
              variant="caption"
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
