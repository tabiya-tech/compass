import React, { startTransition, useEffect, useMemo, useState } from "react";
import { createHashRouter, Outlet, RouterProvider, useRouteError } from "react-router-dom";
import Layout from "src/app/Layout";
import Login from "src/auth/pages/Login/Login";
import AuthLayout from "src/auth/components/AuthLayout/AuthLayout";
import ErrorPage from "src/error/errorPage/ErrorPage";
import Register from "src/auth/pages/Register/Register";
import VerifyEmail from "src/auth/pages/VerifyEmail/VerifyEmail";
import AuthHandler from "src/auth/pages/AuthHandler/AuthHandler";
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
import Home from "src/home/Home";
import { AppErrorFallback } from "src/error/errorPage/AppErrorFallback";
import BugReportButton from "../feedback/bugReport/bugReportButton/BugReportButton";
import LegalDocumentPage from "src/legal/pages/LegalDocumentPage";

const LazyLoadedSensitiveDataForm = lazyWithPreload(
  () => import("src/sensitiveData/components/sensitiveDataForm/SensitiveDataForm")
);
const LazyLoadedChat = lazyWithPreload(() => import("src/chat/Chat"));

const LazyLoadedKnowledgeHubDocument = lazyWithPreload(() => import("src/knowledgeHub/pages/KnowledgeHubDocument"));
const LazyLoadedKnowledgeHubList = lazyWithPreload(() => import("src/knowledgeHub/pages/KnowledgeHubList"));
const LazyLoadedCareerExplorer = lazyWithPreload(
  () => import("src/careerExplorer/pages/CareerExplorerPage/CareerExplorerPage")
);

const LazyLoadedCareerReadinessList = lazyWithPreload(
  () => import("src/careerReadiness/pages/CareerReadinessList/CareerReadinessList")
);
const LazyLoadedCareerReadinessModule = lazyWithPreload(
  () => import("src/careerReadiness/pages/CareerReadinessModule/CareerReadinessModule")
);

const LazyLoadedProfile = lazyWithPreload(() => import("src/profile/ProfileContainer"));
const LazyLoadedJobMatching = lazyWithPreload(() => import("src/jobMatching/pages/JobMatchingPage/JobMatchingPage"));
const LazyLoadedFAQPage = lazyWithPreload(() => import("src/faq/pages/FAQPage"));

// Wrap the createHashRouter function with Sentry to capture errors that occur during router initialization
const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouterV6(createHashRouter);

const uniqueId = "17ccbdb7-1855-44b2-bc68-ef066e5c4e6f";
export const SNACKBAR_KEYS = {
  OFFLINE_ERROR: `offline-error-${uniqueId}`,
  ONLINE_SUCCESS: `online-success-${uniqueId}`,
};

const ProtectedRouteKeys = {
  ROOT: "ROOT",
  SKILLS_INTERESTS: "SKILLS_INTERESTS",
  LANDING: "LANDING",
  SETTINGS: "SETTINGS",
  REGISTER: "REGISTER",
  LOGIN: "LOGIN",
  VERIFY_EMAIL: "VERIFY_EMAIL",
  PROFILE: "PROFILE",
  CONSENT: "CONSENT",
  SENSITIVE_DATA: "SENSITIVE_DATA",
  KNOWLEDGE_HUB: "KNOWLEDGE_HUB",
  KNOWLEDGE_HUB_DOCUMENT: "KNOWLEDGE_HUB_DOCUMENT",
  CAREER_EXPLORER: "CAREER_EXPLORER",
  CAREER_READINESS: "CAREER_READINESS",
  CAREER_READINESS_MODULE: "CAREER_READINESS_MODULE",
  JOB_MATCHING: "JOB_MATCHING",
};

const NotFound: React.FC = () => {
  const { t } = useTranslation();
  return <ErrorPage errorMessage={t("error.errorPage.notFound")} />;
};

const RouterErrorBoundary: React.FC = () => {
  const error = useRouteError();
  return <AppErrorFallback error={error} />;
};

const App = () => {
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
        console.debug("Token could not be refreshed. User is not logged in");
        return;
      }

      // get the user from the token (validating again internally)
      const user = authenticationServiceInstance.getUser(token);
      if (!user) {
        console.debug(
          "Authentication token is not valid or user could not be extracted from token. Logging out the user."
        );
        await authenticationServiceInstance.logout();
        return;
      }

      console.debug("Valid token found in storage");

      authenticationStateService.setUser(user);
      authenticationStateService.setToken(token);

      let preferences = null;
      try {
        // Bootstrap can race the registration POST that creates the preferences doc;
        // retry the 404 before treating the user as truly unregistered and logging out.
        preferences = await UserPreferencesService.getInstance().getUserPreferences(user.id, { retryOn404: true });
      } catch (error) {
        if (
          error instanceof RestAPIError &&
          error.serviceName === UserPreferencesService.serviceName &&
          error.statusCode === StatusCodes.NOT_FOUND &&
          error.method === "GET"
        ) {
          // User is not registered but has a valid token
          console.warn("User has not registered but has a valid token. Logging out user.");
        } else {
          // Unexpected error while retrieving user preferences
          console.error(new AuthenticationError("Error retrieving user preferences. Logging out user.", error));
        }

        // Log out in both cases
        await authenticationServiceInstance.logout();
        return;
      }

      if (!preferences) {
        console.debug("User has not registered! logging them out", user.id);
        await authenticationServiceInstance.logout();
        return;
      }

      UserPreferencesStateService.getInstance().setUserPreferences(preferences);
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
      window.location.href = `/#${routerPaths.LOGIN}`;
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

  // Check if registration is disabled
  const isRegistrationDisabled = getRegistrationDisabled().toLowerCase() === "true";

  const router = useMemo(
    () =>
      sentryCreateBrowserRouter([
        {
          path: routerPaths.ROOT,
          element: <Outlet />,
          errorElement: <RouterErrorBoundary />,
          children: [
            // Authenticated routes with Layout (NavBar + SubNavBar)
            {
              element: <Layout />,
              children: [
                {
                  index: true,
                  element: (
                    <ProtectedRoute key={ProtectedRouteKeys.ROOT}>
                      <Home />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: routerPaths.SKILLS_INTERESTS,
                  handle: {
                    title: "home.modules.skillsDiscovery",
                    subtitle: "home.modules.skillsDiscoverySubtitle",
                    headerColor: "primary",
                  },
                  element: (
                    <ProtectedRoute key={ProtectedRouteKeys.SKILLS_INTERESTS}>
                      <LazyLoadedChat />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: routerPaths.KNOWLEDGE_HUB,
                  handle: {},
                  element: (
                    <ProtectedRoute key={ProtectedRouteKeys.KNOWLEDGE_HUB}>
                      <LazyLoadedKnowledgeHubList />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: routerPaths.KNOWLEDGE_HUB_DOCUMENT,
                  handle: {},
                  element: (
                    <ProtectedRoute key={ProtectedRouteKeys.KNOWLEDGE_HUB_DOCUMENT}>
                      <LazyLoadedKnowledgeHubDocument />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: routerPaths.CAREER_EXPLORER,
                  handle: {
                    title: "careerExplorer.title",
                    subtitle: "careerExplorer.subtitle",
                    headerColor: "brandAction",
                  },
                  element: (
                    <ProtectedRoute key={ProtectedRouteKeys.CAREER_EXPLORER}>
                      <LazyLoadedCareerExplorer />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: routerPaths.CAREER_READINESS,
                  element: (
                    <ProtectedRoute key={ProtectedRouteKeys.CAREER_READINESS}>
                      <LazyLoadedCareerReadinessList />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: routerPaths.CAREER_READINESS_MODULE,
                  handle: {
                    headerColor: "secondary",
                  },
                  element: (
                    <ProtectedRoute key={ProtectedRouteKeys.CAREER_READINESS_MODULE}>
                      <LazyLoadedCareerReadinessModule />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: routerPaths.PROFILE,
                  handle: {
                    headerColor: "primary",
                  },
                  element: (
                    <ProtectedRoute key={ProtectedRouteKeys.PROFILE}>
                      <LazyLoadedProfile />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: routerPaths.JOB_MATCHING,
                  handle: {},
                  element: (
                    <ProtectedRoute key={ProtectedRouteKeys.JOB_MATCHING}>
                      <LazyLoadedJobMatching />
                    </ProtectedRoute>
                  ),
                },
              ],
            },
            // Unauthenticated routes (no Layout)
            {
              element: <AuthLayout />,
              children: [
                {
                  path: routerPaths.LANDING,
                  element: (
                    <ProtectedRoute key={ProtectedRouteKeys.LANDING}>
                      <Landing />
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
                  path: routerPaths.AUTH_HANDLER,
                  element: <AuthHandler />,
                },
              ],
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
              path: routerPaths.PRIVACY_POLICY,
              element: <LegalDocumentPage variant="privacy" />,
            },
            {
              path: routerPaths.TERMS_OF_USE,
              element: <LegalDocumentPage variant="terms" />,
            },
            {
              path: routerPaths.FAQ,
              element: <LazyLoadedFAQPage />,
            },
            {
              path: "*",
              element: <NotFound />,
            },
          ],
        },
      ]),
    [isRegistrationDisabled]
  );

  if (loading) return <Backdrop isShown={loading} transparent={true} />;

  return (
    <>
      <RouterProvider router={router} />
      <BugReportButton bottomAlign={true} />
    </>
  );
};

export default Sentry.withProfiler(App);
