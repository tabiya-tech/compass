import React, { startTransition, useEffect, useState } from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import Login from "src/auth/pages/Login/Login";
import ErrorPage from "src/error/errorPage/ErrorPage";
import Register from "src/auth/pages/Register/Register";
import VerifyEmail from "src/auth/pages/VerifyEmail/VerifyEmail";
import Consent from "src/consent/components/consentPage/Consent";
import Landing from "src/auth/pages/Landing/Landing";

import ProtectedRoute from "src/app/ProtectedRoute/ProtectedRoute";
import { routerPaths } from "src/app/routerPaths";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { Backdrop } from "src/theme/Backdrop/Backdrop";

import * as Sentry from "@sentry/react";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import UserPreferencesService from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { AuthenticationError } from "src/error/commonErrors";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import { StatusCodes } from "http-status-codes";
import { lazyWithPreload } from "src/utils/preloadableComponent/PreloadableComponent";
import { TokenValidationFailureCause } from "src/auth/services/Authentication.service";
import { AuthBroadcastChannel, AuthChannelMessage } from "src/auth/services/authBroadcastChannel/authBroadcastChannel";
import { getRegistrationDisabled } from "src/envService";
import { useTranslation } from "react-i18next";

const LazyLoadedSensitiveDataForm = lazyWithPreload(
  () => import("src/sensitiveData/components/sensitiveDataForm/SensitiveDataForm")
);
const LazyLoadedChat = lazyWithPreload(() => import("src/chat/Chat"));

// Wrap the createHashRouter function with Sentry to capture errors that occur during router initialization
const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouterV6(createHashRouter);

const uniqueId = "17ccbdb7-1855-44b2-bc68-ef066e5c4e6f";
export const SNACKBAR_KEYS = {
  OFFLINE_ERROR: `offline-error-${uniqueId}`,
  ONLINE_SUCCESS: `online-success-${uniqueId}`,
};

const ProtectedRouteKeys = {
  ROOT: "ROOT",
  LANDING: "LANDING",
  SETTINGS: "SETTINGS",
  REGISTER: "REGISTER",
  LOGIN: "LOGIN",
  VERIFY_EMAIL: "VERIFY_EMAIL",
  CONSENT: "CONSENT",
  SENSITIVE_DATA: "SENSITIVE_DATA",
};

const App = () => {
  const NotFound: React.FC = () => {
    const { t } = useTranslation();
    return <ErrorPage errorMessage={t("error.errorPage.notFound")} />;
  };

  const [loading, setLoading] = useState(true);

  const loadApplicationState = async () => {
    try {
      const authenticationServiceInstance = AuthenticationServiceFactory.getCurrentAuthenticationService();
      const authenticationStateService = AuthenticationStateService.getInstance();

      // load token from persistent storage to authentication state
      authenticationStateService.loadToken();

      // get the token from authentication state
      let token = authenticationStateService.getToken();

      if (!authenticationServiceInstance || !token) {
        // reset to clean state and exit if there is no authentication service instance or token.
        console.debug("No authentication service instance or token found. User is not logged in");
        // Clear the user state on app start if there is no authentication service instance or token.
        await AuthenticationServiceFactory.resetAuthenticationState();
        return;
      }

      // if the token is expired, refresh it.
      if (
        authenticationServiceInstance.isTokenValid(token).failureCause === TokenValidationFailureCause.TOKEN_EXPIRED
      ) {
        // IF — no valid session in the provider (firebase or external provider),
        //    — and the token has expired,
        // THEN Log out the user to clear the state because we cannot refresh the token.
        const isProviderSessionValid = await authenticationServiceInstance.isProviderSessionValid();
        if (!isProviderSessionValid) {
          console.error(
            new AuthenticationError("Authentication provider session is not valid/available. Logging out user.")
          );
          await authenticationServiceInstance.logout();
          return;
        }

        console.debug("Token is expired getting new token for user...");
        await authenticationServiceInstance.refreshToken();
        token = authenticationStateService.getToken();
      }

      // the token may be null if something went wrong during the refresh.
      if (!token) {
        console.warn("Token could not be refreshed. User is not logged in");
        return;
      }

      // get the user from the token (validating again internally)
      const user = authenticationServiceInstance.getUser(token);
      if (!user) {
        console.debug("Authentication token is not valid or user could not be extracted from token");
        await authenticationServiceInstance.logout();
        return;
      }

      console.debug("Valid token found in storage");

      authenticationStateService.setUser(user);
      authenticationStateService.setToken(token);

      const preferences = await UserPreferencesService.getInstance()
        .getUserPreferences(user.id)
        .catch((error) => {
          console.log(error, "init");
          if (error instanceof RestAPIError) {
            // if the user is not registered, but has a valid token, log an error and continue log the user out
            if (
              error.serviceName === UserPreferencesService.serviceName &&
              error.statusCode === StatusCodes.NOT_FOUND &&
              error.method === "GET"
            ) {
              console.error(
                new AuthenticationError(
                  `User has not registered! Preferences could not be found for userId: ${user.id}`,
                  error
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

      UserPreferencesStateService.getInstance().setUserPreferences(preferences);

      console.debug("User preferences loaded", preferences);
    } catch (error) {
      console.error(new AuthenticationError("Error initializing authentication and user preferences state", error));
      await AuthenticationServiceFactory.resetAuthenticationState();
    }
  };

  useEffect(() => {
    const channel = AuthBroadcastChannel.getInstance();

    // When another tab logs out, perform local cleanup only
    // Do not run the full logout flow here — that would rebroadcast or close the shared channel
    const logoutListener = async () => {
      await AuthenticationServiceFactory.resetAuthenticationState();

      // Redirect without a page reload
      window.location.href = `/#${routerPaths.LANDING}`;
    };

    // When another tab logs in, reload the application state
    const loginListener = async () => {
      try {
        await loadApplicationState();

        // Use startTransition to delay navigation, preventing suspension errors from lazy-loaded components
        startTransition(() => {
          window.location.href = `/#${routerPaths.ROOT}`;
        });
      } catch (e) {
        console.error(new Error("Error loading application state after login broadcast"), { cause: e });
      }
    };

    const unsubscribeLogout = channel.registerListener(AuthChannelMessage.LOGOUT_USER, logoutListener);
    const unsubscribeLogin = channel.registerListener(AuthChannelMessage.LOGIN_USER, loginListener);

    return () => {
      unsubscribeLogout();
      unsubscribeLogin();
      // Keep the shared channel open; close it only on page unload/root teardown
    };
  }, []);

  useEffect(() => {
    const authenticationStateService = AuthenticationStateService.getInstance();

    const initializeAuth = async () => {
      setLoading(true);
      await loadApplicationState();
      setLoading(false);
    };

    initializeAuth().then(() => {
      console.debug(
        "Auth initialized successfully",
        UserPreferencesStateService.getInstance().getUserPreferences(),
        authenticationStateService.getUser()
      );
    });

    // Add visibility change event set the persistent storage token with the one from the state.
    const handleVisibilityChange = async () => {
      console.debug("Visibility change, setting token to persistent storage and state");

      const token = authenticationStateService.getToken();
      // If no token from authenticationStateService, we don't need to update it again.
      if (token) {
        authenticationStateService.setToken(token);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      const currentAuthenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
      try {
        console.debug("Cleaning up auth");
        // Each of the services that implement the AuthenticationService interface will have their own cleanup method
        // they may use this method to clean up any resources they have allocated on component unmount
        // the currentAuthenticationService may be null,
        // since we're not sure if the user has logged in or not.
        currentAuthenticationService?.cleanup();
        // Remove the visibility change event listener
        document.removeEventListener("visibilitychange", handleVisibilityChange);

        // Close the shared broadcast channel on full app teardown / unmount
        AuthBroadcastChannel.getInstance().closeChannel();
      } catch (error) {
        console.error(new AuthenticationError("Error cleaning up auth", error));
      }
    };
  }, []);

  if (loading) return <Backdrop isShown={loading} transparent={true} />;

  // Check if registration is disabled
  const isRegistrationDisabled = getRegistrationDisabled().toLowerCase() === "true";

  const router = sentryCreateBrowserRouter([
    {
      path: routerPaths.ROOT,
      element: (
        <ProtectedRoute key={ProtectedRouteKeys.ROOT}>
          <LazyLoadedChat />
        </ProtectedRoute>
      ),
    },
    {
      path: routerPaths.LANDING,
      element: (
        <ProtectedRoute key={ProtectedRouteKeys.LANDING}>
          <Landing />
        </ProtectedRoute>
      ),
    },
    // Only include register route if registration is not disabled
    ...(isRegistrationDisabled
      ? []
      : [
          {
            path: routerPaths.REGISTER,
            element: (
              <ProtectedRoute key={ProtectedRouteKeys.REGISTER}>
                <Register />
              </ProtectedRoute>
            ),
          },
        ]),
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
          <LazyLoadedSensitiveDataForm />
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

export default Sentry.withProfiler(App);
