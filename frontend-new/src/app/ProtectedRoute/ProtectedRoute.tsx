import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { isValid } from "date-fns";
import authStateService from "src/auth/services/AuthenticationState.service";
import { canAccessChatPage, canAccessPIIPage } from "src/app/ProtectedRoute/util";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const user = authStateService.getInstance().getUser();
  const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();
  const isAcceptedTCValid = userPreferences?.accepted_tc && isValid(new Date(userPreferences.accepted_tc));
  const targetPath = useLocation().pathname;

  if (targetPath === routerPaths.VERIFY_EMAIL) {
    console.debug("redirecting from /verify --> /verify because no one cares");
    return <>{children}</>;
  }

  if (!user || !userPreferences) {
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
    return <Navigate to={routerPaths.CONSENT} />;
  }

  if (targetPath === routerPaths.CONSENT) {
    if (isAcceptedTCValid) {
      console.debug("redirecting from /dpa --> /home because prefs.accepted");
      return <Navigate to={routerPaths.ROOT} />;
    }
    console.debug("redirecting from /dpa --> /dpa because no prefs.accepted");
    return <>{children}</>;
  }

  if (targetPath === routerPaths.ROOT) {
    if (!canAccessChatPage(userPreferences)) {
      console.debug(
        "redirecting from /home --> /sensitive-data because the user is required to provide sensitive data"
      );
      return <Navigate to={routerPaths.SENSITIVE_DATA} />;
    }
  }

  if (targetPath === routerPaths.SENSITIVE_DATA) {
    if (!canAccessPIIPage(userPreferences)) {
      console.debug("redirecting from /sensitive --> /home because the user is not required to provide sensitive data");
      return <Navigate to={routerPaths.ROOT} />;
    }
  }

  if (!isAcceptedTCValid) {
    console.debug("redirecting from ? --> /dpa because no prefs.accepted");
    return <Navigate to={routerPaths.CONSENT} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
