import { Route, Routes } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import Home from "src/homePage/Home";
import Info from "src/info/Info";
import Register from "src/auth/pages/Register/Register";
import Login from "src/auth/pages/Login/Login";
import DataProtectionAgreement from "src/dataProtectionAgreement/DataProtectionAgreement";
import VerifyEmail from "src/auth/pages/VerifyEmail/VerifyEmail";
import NotFound from "src/errorPage/NotFound";
import ProtectedRoute from "src/app/ProtectedRoute/ProtectedRoute";
import { useEffect } from "react";
import authStateService from "../auth/AuthStateService";
import { userPreferencesStateService } from "../userPreferences/UserPreferencesProvider/UserPreferencesStateService";

const uniqueId = "17ccbdb7-1855-44b2-bc68-ef066e5c4e6f";
export const SNACKBAR_KEYS = {
  OFFLINE_ERROR: `offline-error-${uniqueId}`,
  ONLINE_SUCCESS: `online-success-${uniqueId}`,
};

const ProtectedRouteKeys = {
  ROOT: "ROOT",
  SETTINGS: "SETTINGS",
  REGISTER: "REGISTER",
  LOGIN: "LOGIN",
  VERIFY_EMAIL: "VERIFY_EMAIL",
  DPA: "DPA",
};
const App = () => {

  useEffect(() => {
    authStateService.loadUser().then(() => {
      const user = authStateService.getUser()
      if(user) userPreferencesStateService.loadPreferences(user.id)
    })
  }, []);

  return (
    <Routes>
      {/*------*/}
      {/*The following routes require the user to be authenticated*/}
      {/*------*/}
      <Route
        path={routerPaths.ROOT}
        element={
          <ProtectedRoute key={ProtectedRouteKeys.ROOT} authenticationAndDPARequired={true}>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path={routerPaths.SETTINGS}
        element={
          <ProtectedRoute key={ProtectedRouteKeys.SETTINGS} authenticationAndDPARequired={true}>
            <Info />
          </ProtectedRoute>
        }
      />
      {/*------*/}
      {/*The following routes do not require the user to be authenticated*/}
      {/*------*/}
      <Route
        path={routerPaths.REGISTER}
        element={
          <ProtectedRoute key={ProtectedRouteKeys.REGISTER} authenticationAndDPARequired={false}>
            <Register />
          </ProtectedRoute>
        }
      />
      <Route
        path={routerPaths.LOGIN}
        element={
          <ProtectedRoute key={ProtectedRouteKeys.LOGIN} authenticationAndDPARequired={false}>
            <Login />
          </ProtectedRoute>
        }
      />
      <Route
        path={routerPaths.VERIFY_EMAIL}
        element={
          <ProtectedRoute key={ProtectedRouteKeys.VERIFY_EMAIL} authenticationAndDPARequired={false}>
            <VerifyEmail />
          </ProtectedRoute>
        }
      />
      <Route
        path={routerPaths.DPA}
        element={
          <ProtectedRoute key={ProtectedRouteKeys.DPA} authenticationAndDPARequired={false}>
            <DataProtectionAgreement />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
      {/*-----*/}
    </Routes>
  );
};
export default App;
