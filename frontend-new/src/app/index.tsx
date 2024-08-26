import { Route, Routes } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import Home from "src/homePage/Home";
import Info from "src/info/Info";
import RegisterWithEmail from "src/auth/pages/Register/Register";
import LoginWithEmail from "src/auth/pages/Login/Login";
import DataProtectionAgreement from "src/dataProtectionAgreement/DataProtectionAgreement";
import VerifyEmail from "src/auth/pages/VerifyEmail/VerifyEmail";
import NotFound from "src/errorPage/NotFound";
import ProtectedRoute from "src/app/ProtectedRoute/ProtectedRoute";

const uniqueId = "17ccbdb7-1855-44b2-bc68-ef066e5c4e6f";
export const SNACKBAR_KEYS = {
  OFFLINE_ERROR: `offline-error-${uniqueId}`,
  ONLINE_SUCCESS: `online-success-${uniqueId}`,
};
const App = () => {
  return (
    <Routes>
      {/*------*/}
      {/*The following routes require the user to be authenticated*/}
      {/*------*/}
      <Route
        path={routerPaths.ROOT}
        element={
          <ProtectedRoute authenticationAndDPARequired={true}>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path={routerPaths.SETTINGS}
        element={
          <ProtectedRoute authenticationAndDPARequired={true}>
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
          <ProtectedRoute authenticationAndDPARequired={false}>
            <RegisterWithEmail />
          </ProtectedRoute>
        }
      />
      <Route
        path={routerPaths.LOGIN}
        element={
          <ProtectedRoute authenticationAndDPARequired={false}>
            <LoginWithEmail />
          </ProtectedRoute>
        }
      />
      <Route
        path={routerPaths.VERIFY_EMAIL}
        element={
          <ProtectedRoute authenticationAndDPARequired={false}>
            <VerifyEmail />
          </ProtectedRoute>
        }
      />
      <Route
        path={routerPaths.DPA}
        element={
          <ProtectedRoute authenticationAndDPARequired={false}>
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
