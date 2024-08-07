import React, { useContext, useState } from "react";
import { auth } from "src/auth/firebaseConfig";
import firebase from "firebase/compat/app";
import "firebaseui/dist/firebaseui.css";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { TabiyaUser } from "src/auth/auth.types";
import { useTokens } from "src/auth/hooks/useTokens";
import { useAuthUser } from "src/auth/hooks/useAuthUser";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { Box, Typography, Button } from "@mui/material";
import { GoogleIcon } from "src/theme/Icons/GoogleIcon";

const uniqueId = "f0324e97-83fd-49e6-95c3-1043751fa1db";
export const DATA_TEST_ID = {
  FIREBASE_AUTH: `firebase-auth-${uniqueId}`,
  FIREBASE_FALLBACK_TEXT: `firebase-fallback-text-${uniqueId}`,
  FIREBASE_AUTH_CONTAINER: `firebase-auth-container-${uniqueId}`,
  CONTINUE_WITH_GOOGLE: `continue-with-google-${uniqueId}`,
  CONTINUE_WITH_GOOGLE_BUTTON: `continue-with-google-button-${uniqueId}`,
};

export interface IDPAuthProps {
  preLoginCheck?: () => Promise<boolean> | boolean,
  disabled?: boolean;
  label?: string;
  notifyOnLogin: (user: TabiyaUser) => void;
  isLoading: boolean;
}

const IDPAuth: React.FC<Readonly<IDPAuthProps>> = ({ preLoginCheck, disabled = false,  label, notifyOnLogin, isLoading }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const {enqueueSnackbar} = useSnackbar();
  const {updateUserByToken} = useAuthUser();
  const tokens = useTokens({updateUserByToken});

  const [error, setError] = useState("");

  const isOnline = useContext(IsOnlineContext);

  // Memoize firebaseUiWidget and uiConfig to avoid re-initializing on each render
  const loginWithPopup = async () => {
    try {
      setIsLoggingIn(true);
      const passed = await preLoginCheck?.();

      if (!passed) {
        return
      }

      const data = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      enqueueSnackbar("Login successful", {variant: "success"});

      const newUser: TabiyaUser = {
        id: data?.user?.uid!,
        name: data?.user?.displayName!,
        email: data?.user?.email!,
      };

      // @ts-ignore
      const token = data?.user?.multiFactor?.user?.accessToken as string;

      tokens.setToken(token);
      updateUserByToken(token);
      notifyOnLogin(newUser);
      return false;
    } catch (error: any) {
      console.log(error)
      enqueueSnackbar("Login failed", { variant: "error" });
      setError(error.message);
    } finally {
      setIsLoggingIn(false);
    }
  }

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
          {error && <p className="error">{error}</p>}
          {isOnline ? (
            <Button
              variant="text"
              size={"medium"}
              disabled={disabled || isLoading || isLoggingIn}
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
                color: theme => theme.palette.tabiyaBlue.light,
              }}
            >
              <div style={{ display: "flex", alignItems: "center"}}>
                <GoogleIcon />
              </div>
              <div>
                {label || "Sign in with Google"}
              </div>
            </Button>
          ) : (
            <p data-testid={DATA_TEST_ID.FIREBASE_FALLBACK_TEXT}>Google sign in is not available when offline.</p>
          )}
        </div>

      </Box>
    </Box>
  );
};

export default React.memo(IDPAuth);
