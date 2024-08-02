import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import firebase from "firebase/compat/app";
import * as firebaseui from "firebaseui";
import "firebaseui/dist/firebaseui.css";
import { auth } from "src/auth/firebaseConfig";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { TabiyaUser } from "src/auth/auth.types";
import { useTokens } from "src/auth/hooks/useTokens";
import { useAuthUser } from "src/auth/hooks/useAuthUser";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { Box, Typography } from "@mui/material";

const uniqueId = "f0324e97-83fd-49e6-95c3-1043751fa1db";
export const DATA_TEST_ID = {
  FIREBASE_AUTH: `firebase-auth-${uniqueId}`,
  FIREBASE_FALLBACK_TEXT: `firebase-fallback-text-${uniqueId}`,
  FIREBASE_AUTH_CONTAINER: `firebase-auth-container-${uniqueId}`,
  CONTINUE_WITH_GOOGLE: `continue-with-google-${uniqueId}`,
};

export interface IDPAuthProps {
  notifyOnLogin: (user: TabiyaUser) => void;
  isLoading: boolean;
}

const IDPAuth: React.FC<Readonly<IDPAuthProps>> = ({ notifyOnLogin, isLoading }) => {
  const { enqueueSnackbar } = useSnackbar();
  const { updateUserByIDToken } = useAuthUser();
  const tokens = useTokens({ updateUserByIDToken });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const firebaseUIElementRef = useRef(null);

  const isOnline = useContext(IsOnlineContext);

  // Memoize firebaseUiWidget and uiConfig to avoid re-initializing on each render
  const firebaseUiWidget = useMemo(() => firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(auth), []);

  const uiConfig = useMemo(
    () => ({
      signInFlow: "popup", // 'redirect', if you do not want to use popup
      signInOptions: [firebase.auth.GoogleAuthProvider.PROVIDER_ID],
      callbacks: {
        signInSuccessWithAuthResult: (data: any) => {
          enqueueSnackbar("Login successful", { variant: "success" });
          const newUser: TabiyaUser = {
            id: data.user.uid,
            name: data.user.displayName,
            email: data.user.email,
          };
          tokens.setAccessToken(data?.user?.multiFactor?.user?.accessToken as string);
          updateUserByIDToken(data?.user?.multiFactor?.user?.accessToken as string);
          notifyOnLogin(newUser);
          return false;
        },
        signInFailure: (error: { message: string }) => {
          enqueueSnackbar("Login failed", { variant: "error" });
          setError(error.message);
          setLoading(false);
        },
      },
    }),
    [enqueueSnackbar, tokens, updateUserByIDToken, notifyOnLogin]
  );

  useEffect(() => {
    setLoading(true);
    if (uiConfig.signInFlow === "popup") firebaseUiWidget.reset();

    // Render the firebaseUi Widget.
    if (isOnline) firebaseUiWidget.start(firebaseUIElementRef.current!, uiConfig);
    setLoading(false);

    return () => {
      firebaseUiWidget.reset();
    };
  }, [firebaseUiWidget, uiConfig, isOnline]);

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
          {(loading || isLoading) && <p>Loading...</p>}
          {error && <p className="error">{error}</p>}
          {isOnline ? (
            <div id="firebaseui-auth-container" ref={firebaseUIElementRef}></div>
          ) : (
            <p data-testid={DATA_TEST_ID.FIREBASE_FALLBACK_TEXT}>Google sign in is not available when offline.</p>
          )}
        </div>
      </Box>
    </Box>
  );
};

export default React.memo(IDPAuth);
