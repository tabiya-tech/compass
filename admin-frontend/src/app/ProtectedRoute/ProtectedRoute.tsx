import React, { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { routerPaths } from "src/app/routerPaths";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import UserStateService from "src/userState/UserStateService";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * ProtectedRoute component that guards routes from unauthenticated access.
 * Redirects unauthenticated users to the login page.
 * Redirects authenticated users away from the login page to the root.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const user = AuthenticationStateService.getInstance().getUser();
  const userStateService = UserStateService.getInstance();
  const targetPath = useLocation().pathname;
  const homePath = userStateService.isInstitutionStaff() ? routerPaths.INSTRUCTOR : routerPaths.ROOT;

  // If on login page
  if (targetPath === routerPaths.LOGIN) {
    // If already authenticated, redirect to root
    if (user) {
      console.debug(`redirecting from /login --> ${homePath} because user is authenticated`);
      return <Navigate to={homePath} replace />;
    }
    // Otherwise, show login page
    console.debug("showing login page because no user");
    return <>{children}</>;
  }

  // For all other routes, require authentication
  if (!user) {
    console.debug(`redirecting from ${targetPath} --> /login because no user`);
    return <Navigate to={routerPaths.LOGIN} replace />;
  }

  // Keep institution staff on the instructor dashboard route.
  if (targetPath === routerPaths.ROOT && userStateService.isInstitutionStaff()) {
    console.debug(`redirecting from / --> ${routerPaths.INSTRUCTOR} for institution staff`);
    return <Navigate to={routerPaths.INSTRUCTOR} replace />;
  }

  // Restrict user-management ("permissioning") routes to admins.
  if (targetPath === routerPaths.USERS && !userStateService.isAdmin() && !userStateService.isSuperAdmin()) {
    console.debug(`redirecting from ${targetPath} --> ${homePath} because user is not an admin`);
    return <Navigate to={homePath} replace />;
  }

  // User is authenticated, show the page
  return <>{children}</>;
};

export default ProtectedRoute;
