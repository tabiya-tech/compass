import React from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import Home from "src/homePage/Home";
import Info from "src/info/Info";
import Register from "src/auth/pages/Register/Register";
import Login from "src/auth/pages/Login/Login";
import DataProtectionAgreement from "src/dataProtectionAgreement/DataProtectionAgreement";
import VerifyEmail from "src/auth/pages/VerifyEmail/VerifyEmail";
import NotFound from "src/errorPage/NotFound";
import ProtectedRoute from "src/app/ProtectedRoute/ProtectedRoute";
import { routerPaths } from "src/app/routerPaths";

const uniqueId = "17ccbdb7-1855-44b2-bc68-ef066e5c4e6f";
export const SNACKBAR_KEYS = {
  OFFLINE_ERROR: `offline-error-${uniqueId}`,
  ONLINE_SUCCESS: `online-success-${uniqueId}`,
};

const ProtectedRouteKeys = {
  ROOT: "ROOT",
  SETTINGS: "SETTINGS",
  REGISTER: "REGISTER",
  LOGIN: "LOGIN",
  VERIFY_EMAIL: "VERIFY_EMAIL",
  DPA: "DPA",
};



const App = () => {
  // Define the routes using createHashRouter
  const router = createHashRouter([
    {
      path: routerPaths.ROOT,
      element: (
        <ProtectedRoute key={ProtectedRouteKeys.ROOT}>
          <Home />
        </ProtectedRoute>
      ),
    },
    {
      path: routerPaths.SETTINGS,
      element: (
        <ProtectedRoute key={ProtectedRouteKeys.SETTINGS}>
          <Info />
        </ProtectedRoute>
      ),
    },
    {
      path: routerPaths.REGISTER,
      element: (
        <ProtectedRoute key={ProtectedRouteKeys.REGISTER}>
          <Register />
        </ProtectedRoute>
      ),
    },
    {
      path: routerPaths.LOGIN,
      element: (
        <ProtectedRoute key={ProtectedRouteKeys.LOGIN}>
          <Login />
        </ProtectedRoute>
      ),
    },
    {
      path: routerPaths.VERIFY_EMAIL,
      element: (
        <ProtectedRoute key={ProtectedRouteKeys.VERIFY_EMAIL}>
          <VerifyEmail />
        </ProtectedRoute>
      ),
    },
    {
      path: routerPaths.DPA,
      element: (
        <ProtectedRoute key={ProtectedRouteKeys.DPA}>
          <DataProtectionAgreement />
        </ProtectedRoute>
      ),
    },
    {
      path: "*",
      element: <NotFound />,
    },
  ]);
  return <RouterProvider router={router} />;
};

export default App;
