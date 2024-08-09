import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { UserPreferencesContext } from "src/userPreferences/UserPreferencesProvider/UserPreferencesProvider";
import { AuthContext } from "src/auth/AuthProvider";
import { isValid } from "date-fns";

interface ProtectedRouteProps {
  authenticationAndDPARequired: boolean;
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ authenticationAndDPARequired, children }) => {
  const { user } = useContext(AuthContext);
  const { userPreferences } = useContext(UserPreferencesContext);

  const isAcceptedTCValid = userPreferences?.accepted_tc && isValid(new Date(userPreferences.accepted_tc));

  if (authenticationAndDPARequired && (!user || !isAcceptedTCValid)) {
    console.log({ userPreferences }, "userPreferences ---");
    // if the user is not found or the terms and conditions aren't accepted
    // log the user out fully to preserve the state of the application
    // and then redirect to login page
    return <Navigate to={routerPaths.LOGIN} replace />;
  }

  if (!authenticationAndDPARequired && user && isAcceptedTCValid) {
    // if there is a user and they have accepted the terms and conditions
    // redirect to the root page
    console.log({ userPreferences }, "userPreferences ***");
    return <Navigate to={routerPaths.ROOT} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
