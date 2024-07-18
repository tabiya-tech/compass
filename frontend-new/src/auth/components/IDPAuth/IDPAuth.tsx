import { SetStateAction, useCallback, useContext, useEffect, useState } from "react";
import firebase from "firebase/compat/app";
import * as firebaseui from "firebaseui";
import "firebaseui/dist/firebaseui.css";
import { auth } from "src/auth/firebaseConfig";
import { routerPaths } from "src/app/routerPaths";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { TabiyaUser } from "src/auth/auth.types";
import { useTokens } from "src/auth/hooks/useTokens";
import { useAuthUser } from "src/auth/hooks/useAuthUser";
import { getUserFriendlyErrorMessage } from "src/error/error";
import { writeServiceErrorToLog } from "src/error/logger";
import { UserPreferencesContext } from "src/auth/Providers/UserPreferencesProvider/UserPreferencesProvider";
import { AuthContext } from "src/auth/Providers/AuthProvider/AuthProvider";

const uniqueId = "f0324e97-83fd-49e6-95c3-1043751fa1db";
export const DATA_TEST_ID = {
  FIREBASE_AUTH: `firebase-auth-${uniqueId}`,
};

const IDPAuth = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const { updateUserByIDToken } = useAuthUser();
  const tokens = useTokens({ updateUserByIDToken: updateUserByIDToken });

  const [isCheckingPreferences, setIsCheckingPreferences] = useState(false);
  const { user } = useContext(AuthContext);
  const { getUserPreferences, userPreferences } = useContext(UserPreferencesContext);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Redirect the user to the login page
   * if they are already logged in
   */
  useEffect(() => {
    // If the user is already logged in, redirect to the home page
    if (user && userPreferences?.accepted_tc) {
      navigate(routerPaths.ROOT, { replace: true });
    }
  }, [navigate, user, userPreferences]);

  /**
   * Check if the user has accepted the terms and conditions
   * @param user
   */
  const checkUserPreferences = useCallback(
    async (user: TabiyaUser) => {
      try {
        setIsCheckingPreferences(true);
        getUserPreferences(
          user.id,
          (prefs) => {
            setIsCheckingPreferences(false);
            // If the accepted_tc is not set or is not a valid date, redirect to the DPA page
            // this is to ensure that even if the accepted_tc is manipulated in the database, the user will be redirected to the DPA page
            // and will have to accept the terms and conditions again
            if (!prefs?.accepted_tc || isNaN(prefs?.accepted_tc.getTime())) {
              setIsCheckingPreferences(false);
              navigate(routerPaths.DPA, { replace: true });
            } else {
              setIsCheckingPreferences(false);
              navigate(routerPaths.ROOT, { replace: true });
              enqueueSnackbar("Welcome back!", { variant: "success" });
            }
          },
          (error) => {
            setIsCheckingPreferences(false);
            writeServiceErrorToLog(error, console.error);
            throw error;
          }
        );
      } catch (e) {
        const errorMessage = getUserFriendlyErrorMessage(e as Error);
        enqueueSnackbar(errorMessage, { variant: "error" });
        console.error("Error during login process", e);
      }
    },
    [navigate, enqueueSnackbar, getUserPreferences]
  );

  useEffect(() => {
    setLoading(true);
    const uiConfig = {
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
          checkUserPreferences(newUser).then(() => {
            setLoading(false);
          });
          return false;
        },
        signInFailure: (error: { message: SetStateAction<string> }) => {
          enqueueSnackbar("Login failed", { variant: "error" });
          setError(error.message);
          setLoading(false);
        },
      },
    };
    const ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(auth);
    ui.start("#firebaseui-auth-container", uiConfig);
    setLoading(false);
  }, [navigate, enqueueSnackbar, checkUserPreferences, tokens, updateUserByIDToken]);

  return (
    <div data-test_id={DATA_TEST_ID.FIREBASE_AUTH}>
      {(loading || isCheckingPreferences) && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      <div id="firebaseui-auth-container"></div>
    </div>
  );
};

export default IDPAuth;
