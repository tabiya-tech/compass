import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import authStateService from "src/auth/services/AuthenticationState.service";
import { isAcceptedTCValid, isSensitiveDataValid } from "src/app/ProtectedRoute/util";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const user = authStateService.getInstance().getUser();
  const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();

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

  //--- by now we know we have a user and some preferences

  if (targetPath === routerPaths.CONSENT) {
    if (isAcceptedTCValid(userPreferences)) {
      console.debug("redirecting from /dpa --> /home because prefs.accepted");
      return <Navigate to={routerPaths.ROOT} />;
    }
    console.debug("redirecting from /dpa --> /dpa because no prefs.accepted");
    return <>{children}</>;
  }

  if (targetPath === routerPaths.SENSITIVE_DATA) {
    if (isSensitiveDataValid(userPreferences)) {
      console.debug("redirecting from /sensitive --> /home because the user is not required to provide sensitive data");
      return <Navigate to={routerPaths.ROOT} />;
    }
  }

  // Redirect from auth-related paths to root when all conditions are met
  if (targetPath === routerPaths.LOGIN || targetPath === routerPaths.REGISTER) {
    if (isAcceptedTCValid(userPreferences) && isSensitiveDataValid(userPreferences)) {
      console.debug("redirecting from auth path --> /home because all conditions are met");
      return <Navigate to={routerPaths.ROOT} />;
    }
  }

  if(targetPath !== routerPaths.CONSENT) {
    if (!isAcceptedTCValid(userPreferences)) {
      console.debug("redirecting from ? --> /dpa because no prefs.accepted");
      return <Navigate to={routerPaths.CONSENT} />;
    }
  }

  if(targetPath !== routerPaths.SENSITIVE_DATA) {
    if (!isSensitiveDataValid(userPreferences)) {
      console.debug("redirecting to /sensitive-data because user needs to provide sensitive data");
      return <Navigate to={routerPaths.SENSITIVE_DATA} />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
