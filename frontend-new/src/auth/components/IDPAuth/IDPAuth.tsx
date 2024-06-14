import { SetStateAction, useEffect, useState } from "react";
import firebase from "firebase/compat/app";
import * as firebaseui from "firebaseui";
import "firebaseui/dist/firebaseui.css";
import { auth } from "src/auth/firebaseConfig";
import { routerPaths } from "src/app/routerPaths";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";

const uniqueId = "f0324e97-83fd-49e6-95c3-1043751fa1db";
export const DATA_TEST_ID = {
  FIREBASE_AUTH: `firebase-auth-${uniqueId}`,
};

const IDPAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    setLoading(true);
    const uiConfig = {
      signInFlow: "popup", // 'redirect', if you do not want to use popup
      signInOptions: [firebase.auth.GoogleAuthProvider.PROVIDER_ID],
      callbacks: {
        signInSuccessWithAuthResult: (data: any) => {
          enqueueSnackbar("Login successful", { variant: "success" });
          setLoading(false);
          navigate(routerPaths.DPA);
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
  }, [navigate, enqueueSnackbar]);

  return (
    <div data-test_id={DATA_TEST_ID.FIREBASE_AUTH}>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      <div id="firebaseui-auth-container"></div>
    </div>
  );
};

export default IDPAuth;
