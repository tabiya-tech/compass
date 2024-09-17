import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesProvider/UserPreferencesStateService";
import { isValid } from "date-fns";
import authStateService from "src/auth/AuthStateService";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const user = authStateService.getUser();
  const userPreferences = userPreferencesStateService.getUserPreferences();
  const isAcceptedTCValid = userPreferences?.accepted_tc && isValid(new Date(userPreferences.accepted_tc));
  const targetPath = useLocation().pathname;

  if (targetPath === routerPaths.VERIFY_EMAIL) {
    console.debug("redirecting from /verify --> /verify because no one cares");
    return <>{children}</>;
  }
  if (!user) {
    if (targetPath === routerPaths.LOGIN || targetPath === routerPaths.REGISTER) {
      console.debug("redirecting from /login/register --> /login/register because no user");
      return <>{children}</>;
    }
    console.debug("redirecting from ? --> /login because no user");
    return <Navigate to={routerPaths.LOGIN} />;
  }

  if ((targetPath === routerPaths.LOGIN || targetPath === routerPaths.REGISTER) && user) {
    if (isAcceptedTCValid) {
      console.debug("redirecting from /login/register --> /home because user and prefs.accepted");
      return <Navigate to={routerPaths.ROOT} />;
    }
    console.debug("redirecting from /login/register --> /dpa because user but no prefs.accepted");
    return <Navigate to={routerPaths.DPA} />;
  }
  if (targetPath === routerPaths.DPA) {
    if (isAcceptedTCValid) {
      console.debug("redirecting from /dpa --> /home because prefs.accepted");
      return <Navigate to={routerPaths.ROOT} />;
    }
    console.debug("redirecting from /dpa --> /dpa because no prefs.accepted");
    return <>{children}</>;
  }

  if (!isAcceptedTCValid) {
    console.debug("redirecting from ? --> /dpa because no prefs.accepted");
    return <Navigate to={routerPaths.DPA} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
