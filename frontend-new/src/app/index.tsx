import { createHashRouter, RouterProvider } from "react-router-dom";
import Home from "src/homePage/Home";
import Info from "src/info/Info";
import Register from "src/auth/pages/Register/Register";
import Login from "src/auth/pages/Login/Login";
import DataProtectionAgreement from "src/dataProtectionAgreement/DataProtectionAgreement";
import VerifyEmail from "src/auth/pages/VerifyEmail/VerifyEmail";
import NotFound from "src/errorPage/ErrorPage";
import ProtectedRoute from "src/app/ProtectedRoute/ProtectedRoute";
import { routerPaths } from "src/app/routerPaths";
import React, { useEffect, useState } from "react";
import authStateService from "src/auth/AuthStateService";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesProvider/UserPreferencesStateService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";

import * as Sentry from "@sentry/react";

// Wrap the createHashRouter function with Sentry to capture errors that occur during router initialization
const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouter(
  createHashRouter
);

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      try {
        await authStateService.loadUser();
        const user = authStateService.getUser();
        if (user) {
          console.debug("User authenticated: Welcome,", user.email);
          try {
            await userPreferencesStateService.loadPreferences(user.id);
            // check if user preferences have been loaded
            const preferences = userPreferencesStateService.getUserPreferences();
            console.debug("User preferences loaded", preferences);
            // delay for half a sec so that the loading transition is smoother for the user and not just a flash
            setTimeout(() => setLoading(false), 500)
          } catch (error) {
            console.error("Error loading user preferences", error);
            // delay for half a sec so that the loading transition is smoother for the user and not just a flash
            setTimeout(() => setLoading(false), 500)
          }
        } else {
          console.debug("User not authenticated");
          // delay for half a sec so that the loading transition is smoother for the user and not just a flash
          setTimeout(() => setLoading(false), 500)
        }
      } catch (error) {
        console.error("Error initializing auth", error);
        // delay for half a sec so that the loading transition is smoother for the user and not just a flash
        setTimeout(() => setLoading(false), 500)
      }

      const unsubscribe = authStateService.setupAuthListener();

      return () => {
        console.debug("Cleaning up auth");
        unsubscribe();
        authStateService.clearRefreshTimeout();
      };
    };

    initializeAuth();
  }, []);

  if (loading)  return <Backdrop isShown={loading} transparent={true} />

  const router = sentryCreateBrowserRouter([
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
      element: <NotFound errorMessage={"404 Error - Page Not Found"} />,
    },
  ]);
  return <RouterProvider router={router} />;
};

export default Sentry.withProfiler(App);