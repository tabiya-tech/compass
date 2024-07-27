import React, { useContext, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AuthContext } from "src/auth/AuthProvider/AuthProvider";
import { routerPaths } from "src/app/routerPaths";
import { UserPreferencesContext } from "src/userPreferences/UserPreferencesProvider/UserPreferencesProvider";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { useAuthUser } from "src/auth/hooks/useAuthUser";

interface ProtectedRouteProps {
  authenticationAndDPARequired: boolean;
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ authenticationAndDPARequired, children }) => {
  const { updateUser } = useAuthUser();
  const { user, handlePageLoad } = useContext(AuthContext);
  const { userPreferences } = useContext(UserPreferencesContext);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    handlePageLoad(
      (_user) => {
        updateUser(_user);
      },
      (error) => {
        // do nothing
      }
    );
  }, [enqueueSnackbar, handlePageLoad, navigate, userPreferences?.accepted_tc, updateUser]);

  if (authenticationAndDPARequired && (!user || !userPreferences?.accepted_tc)) {
    // if the user is not found or the terms and conditions aren't accepted
    // log the user out fully to preserve the state of the application
    // and then redirect to login page
    return <Navigate to={routerPaths.LOGIN} replace />;
  }

  if (!authenticationAndDPARequired && (user && userPreferences?.accepted_tc)) {
    // if there is a user and they have accepted the terms and conditions
    // redirect to the root page
    return <Navigate to={routerPaths.ROOT} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
