import { SetStateAction, useCallback, useEffect, useState } from "react";
import firebase from "firebase/compat/app";
import * as firebaseui from "firebaseui";
import "firebaseui/dist/firebaseui.css";
import { auth } from "src/auth/firebaseConfig";
import { routerPaths } from "src/app/routerPaths";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { TabiyaUser } from "src/auth/auth.types";
import UserPreferencesService from "src/auth/services/UserPreferences/userPreferences.service";
import { useTokens } from "src/auth/hooks/useTokens";
import { useAuthUser } from "src/auth/hooks/useAuthUser";

const uniqueId = "f0324e97-83fd-49e6-95c3-1043751fa1db";
export const DATA_TEST_ID = {
  FIREBASE_AUTH: `firebase-auth-${uniqueId}`,
};

const IDPAuth = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const { updateUserByIDToken } = useAuthUser();
  const tokens = useTokens({ updateUserByIDToken: updateUserByIDToken });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Check if the user has accepted the terms and conditions
   * @param user
   */
  const checkUserPreferences = useCallback(
    async (user: TabiyaUser) => {
      const userPreferencesService = new UserPreferencesService();
      try {
        const userPreferences = await userPreferencesService.getUserPreferences(user.id);
        const acceptedTcDate = new Date(userPreferences.accepted_tc);
        // If the accepted_tc is not set or is not a valid date, redirect to the DPA page
        // this is to ensure that even if the accepted_tc is manipulated in the database, the user will be redirected to the DPA page
        // and will have to accept the terms and conditions again
        if (!userPreferences.accepted_tc || isNaN(acceptedTcDate.getTime())) {
          navigate(routerPaths.DPA, { replace: true });
        } else {
          navigate(routerPaths.ROOT, { replace: true });
        }
      } catch (e) {
        enqueueSnackbar("Failed to fetch user preferences", { variant: "error" });
        console.error("Failed to fetch user preferences", e);
      }
    },
    [navigate, enqueueSnackbar]
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
          tokens.setIDToken(data.credential.idToken as string);
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
  }, [navigate, enqueueSnackbar, checkUserPreferences, tokens]);

  return (
    <div data-test_id={DATA_TEST_ID.FIREBASE_AUTH}>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      <div id="firebaseui-auth-container"></div>
    </div>
  );
};

export default IDPAuth;
