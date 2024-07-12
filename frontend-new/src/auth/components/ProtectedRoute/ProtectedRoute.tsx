import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "src/auth/AuthProvider";
import { routerPaths } from "src/app/routerPaths";

interface ProtectedRouteProps {
  authenticationRequired: boolean;
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ authenticationRequired, children }) => {
  const { user } = useContext(AuthContext);

  if (authenticationRequired && !user) {
    return <Navigate to={routerPaths.LOGIN} replace />;
  }

  if (!authenticationRequired && user) {
    return <Navigate to={routerPaths.ROOT} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
