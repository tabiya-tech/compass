import React, { useEffect, useState } from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import Chat from "src/chat/Chat";
import Info from "src/info/Info";
import Login from "src/auth/pages/Login/Login";
import ErrorPage from "src/error/errorPage/ErrorPage";
import Register from "src/auth/pages/Register/Register";
import VerifyEmail from "src/auth/pages/VerifyEmail/VerifyEmail";
import Consent from "src/consent/components/consentPage/Consent";
import SensitiveDataForm from "src/sensitiveData/components/sensitiveDataForm/SensitiveDataForm";

import ProtectedRoute from "src/app/ProtectedRoute/ProtectedRoute";
import { routerPaths } from "src/app/routerPaths";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesStateService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";

import * as Sentry from "@sentry/react";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import { PersistentStorageService } from "./PersistentStorageService/PersistentStorageService";
import UserPreferencesService, {
  userPreferencesService,
} from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { AuthenticationError } from "src/error/commonErrors";
import { ServiceError } from "../error/ServiceError/ServiceError";
import { StatusCodes } from "http-status-codes";

// Wrap the createHashRouter function with Sentry to capture errors that occur during router initialization
const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouter(createHashRouter);

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
  CONSENT: "CONSENT",
  SENSITIVE_DATA: "SENSITIVE_DATA",
};

const App = () => {
  const [loading, setLoading] = useState(true);

  const loadApplicationState = async () => {
    try {
      const authenticationServiceInstance = AuthenticationServiceFactory.getCurrentAuthenticationService();
      const token = PersistentStorageService.getToken();

      if (!authenticationServiceInstance || !token) {
        console.debug("No authentication service instance found. User is not logged in");
        // Clear the user state on app start if there is no authentication service instance or token
        await AuthenticationServiceFactory.resetAuthenticationState();
        return;
      }

      const user = authenticationServiceInstance.getUser(token);
      if (!user || !authenticationServiceInstance.isTokenValid(token).isValid) {
        console.debug("Authentication token is not valid or user could not be extracted from token");
        await authenticationServiceInstance.logout();
        return;
      }

      console.debug("Valid token found in storage");
      AuthenticationStateService.getInstance().setUser(user);

      const preferences = await userPreferencesService.getUserPreferences(user.id).catch((error) => {
        console.log(error, "init");
        if (error instanceof ServiceError) {
          // if the user is not registered, but has a valid token, log an error and continue log the user out
          if (
            error.serviceName === UserPreferencesService.serviceName &&
            error.statusCode === StatusCodes.NOT_FOUND &&
            error.method === "GET"
          ) {
            console.error(
              new AuthenticationError(
                `User has not registered! Preferences could not be found for userId: ${user.id}`,
                error as Error
              )
            );
          }
        }
      });
      if (!preferences) {
        console.debug("User has not registered !", user.id);
        await authenticationServiceInstance.logout();
        return;
      }
      console.debug("User authenticated: Welcome,", user.email);
      userPreferencesStateService.setUserPreferences(preferences);

      console.debug("User preferences loaded", preferences);
    } catch (error) {
      console.error(
        new AuthenticationError("Error initializing authentication and user preferences state", error as Error)
      );
      await AuthenticationServiceFactory.resetAuthenticationState();
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      await loadApplicationState();
      setTimeout(() => setLoading(false), 500); // delay for half a sec so that the loading transition is smoother for the user and not just a flash
      return async () => {
        const currentAuthenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
        try {
          console.debug("Cleaning up auth");
          // Each of the services that implement the AuthenticationService interface will have their own cleanup method
          // they may use this method to clean up any resources they have allocated on component unmount
          currentAuthenticationService!.cleanup();
        } catch (error) {
          console.error(new AuthenticationError("Error cleaning up auth", error as Error));
        }
      };
    };

    initializeAuth();
  }, []);

  if (loading) return <Backdrop isShown={loading} transparent={true} />;

  const router = sentryCreateBrowserRouter([
    {
      path: routerPaths.ROOT,
      element: (
        <ProtectedRoute key={ProtectedRouteKeys.ROOT}>
          <Chat />
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
      path: routerPaths.CONSENT,
      element: (
        <ProtectedRoute key={ProtectedRouteKeys.CONSENT}>
          <Consent />
        </ProtectedRoute>
      ),
    },
    {
      path: routerPaths.SENSITIVE_DATA,
      element: (
        <ProtectedRoute key={ProtectedRouteKeys.SENSITIVE_DATA}>
          <SensitiveDataForm />
        </ProtectedRoute>
      ),
    },
    {
      path: "*",
      element: <ErrorPage errorMessage={"404 Error - Page Not Found"} />,
    },
  ]);
  return <RouterProvider router={router} />;
};

export default Sentry.withProfiler(App);
