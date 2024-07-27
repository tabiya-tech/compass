import { Route, Routes } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import Home from "src/homePage/Home";
import Info from "src/info/Info";
import Register from "src/auth/components/Register/Register";
import Login from "src/auth/components/Login/Login";
import DataProtectionAgreement from "src/dataProtectionAgreement/DataProtectionAgreement";
import VerifyEmail from "src/auth/components/VerifyEmail/VerifyEmail";
import NotFound from "src/errorPage/NotFound";
import ProtectedRoute from "src/app/ProtectedRoute/ProtectedRoute";
import { useRouteHandlers } from "src/app/hooks/useRouteHandlers";

const uniqueId = "17ccbdb7-1855-44b2-bc68-ef066e5c4e6f";
export const SNACKBAR_KEYS = {
  OFFLINE_ERROR: `offline-error-${uniqueId}`,
  ONLINE_SUCCESS: `online-success-${uniqueId}`,
};

const App = () => {
  const { handleLogin, handleRegister, handleAcceptDPA, handleVerifyEmail, isPostLoginLoading } = useRouteHandlers();

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
            <Register
              postRegisterHandler={handleRegister}
              postLoginHandler={handleLogin}
              isPostLoginLoading={isPostLoginLoading}
            />
          </ProtectedRoute>
        }
      />
      <Route
        path={routerPaths.LOGIN}
        element={
          <ProtectedRoute authenticationAndDPARequired={false}>
            <Login postLoginHandler={handleLogin} isLoading={isPostLoginLoading} />
          </ProtectedRoute>
        }
      />
      <Route
        path={routerPaths.VERIFY_EMAIL}
        element={
          <ProtectedRoute authenticationAndDPARequired={false}>
            <VerifyEmail notifyOnEmailVerified={handleVerifyEmail} />
          </ProtectedRoute>
        }
      />
      <Route
        path={routerPaths.DPA}
        element={
          <ProtectedRoute authenticationAndDPARequired={false}>
            <DataProtectionAgreement notifyOnAcceptDPA={handleAcceptDPA} isLoading={isPostLoginLoading} />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
      {/*-----*/}
    </Routes>
  );
};
export default App;
