import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import {
  userPreferencesStateService,
} from "src/userPreferences/UserPreferencesProvider/UserPreferencesStateService";
import { isValid } from "date-fns";
import authStateService from "src/auth/AuthStateService";
import { Sloth } from "src/theme/Sloth/Sloth";
import { Box } from "@mui/material";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const user = authStateService.getUser()
  const userPreferences = userPreferencesStateService.getUserPreferences();
  const isAcceptedTCValid = userPreferences?.accepted_tc && isValid(new Date(userPreferences.accepted_tc));
  const targetPath = useLocation().pathname;

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    authStateService.loadUser().then(() => {
      const user = authStateService.getUser();
      if (user) userPreferencesStateService.loadPreferences(user.id).then(
        () => {
          // delay for half a sec so that the loading transition is smoother for the user and not just a flash
          setTimeout(() => setLoading(false), 500)
        }
      );
      else {
        // delay for half a sec
        setTimeout(() => setLoading(false), 500)
      }
    });
  }, []);

  if (loading) return <Box sx={{display: "flex", flexDirection: "row", justifyContent: "center", alignItems: "center", height: "100dvh"}}><Sloth width="64px"/></Box>

  if (targetPath === routerPaths.VERIFY_EMAIL) {
    console.debug("redirecting from /verify --> /verify because no one cares")
    return <>{children}</>;
  }
  if (!user) {
    if (targetPath === routerPaths.LOGIN || targetPath === routerPaths.REGISTER) {
      console.debug("redirecting from /login/register --> /login/register because no user")
      return <>{children}</>;
    }
    console.debug("redirecting from ? --> /login because no user")
    return <Navigate to={routerPaths.LOGIN} />;
  }

  if ((targetPath === routerPaths.LOGIN || targetPath === routerPaths.REGISTER) && user) {
    if (isAcceptedTCValid) {
      console.debug("redirecting from /login/register --> /home because user and prefs.accepted")
      return <Navigate to={routerPaths.ROOT} />;
    }
    console.debug("redirecting from /login/register --> /dpa because user but no prefs.accepted")
    return <Navigate to={routerPaths.DPA} />;
  }
  if (targetPath === routerPaths.DPA) {
    if (isAcceptedTCValid) {
      console.debug("redirecting from /dpa --> /home because prefs.accepted")
      return <Navigate to={routerPaths.ROOT} />;
    }
    console.debug("redirecting from /dpa --> /dpa because no prefs.accepted")
    return <>{children}</>;
  }

  if (!isAcceptedTCValid) {
    console.debug("redirecting from ? --> /dpa because no prefs.accepted")
    return <Navigate to={routerPaths.DPA} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
