import React, { useEffect, useState } from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { useTranslation } from "react-i18next";

import { routerPaths } from "src/app/routerPaths";
import ProtectedRoute from "src/app/ProtectedRoute/ProtectedRoute";
import Login from "src/pages/Login";
import Dashboard from "src/pages/Dashboard";
import Users from "src/pages/Users";
import Profile from "src/pages/Profile";
import NotFound from "src/pages/NotFound";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import FirebaseEmailAuthenticationService from "src/auth/services/FirebaseAuthenticationService/FirebaseEmailAuthenticationService";
import StdFirebaseAuthenticationService from "src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService";
import UserStateService from "src/userState/UserStateService";
import { getFirebaseErrorFactory } from "src/error/FirebaseError/firebaseError";
import { Box, CircularProgress, Typography } from "@mui/material";
import InstructorDashboard from "src/pages/InstructorDashboard";

// Wrap the createHashRouter function with Sentry to capture errors that occur during router initialization
const sentryCreateHashRouter = Sentry.wrapCreateBrowserRouterV6(createHashRouter);

const router = sentryCreateHashRouter([
  {
    path: routerPaths.ROOT,
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: routerPaths.LOGIN,
    element: (
      <ProtectedRoute>
        <Login />
      </ProtectedRoute>
    ),
  },
  {
    path: routerPaths.INSTRUCTOR,
    element: (
      <ProtectedRoute>
        <InstructorDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: routerPaths.USERS,
    element: (
      <ProtectedRoute>
        <Users />
      </ProtectedRoute>
    ),
  },
  {
    path: routerPaths.PROFILE,
    element: (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

/**
 * Loading component shown while initializing authentication
 */
const LoadingScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        {t("common.status.loading", "Loading...")}
      </Typography>
    </Box>
  );
};

/**
 * Initialize authentication by loading and validating the stored token
 */
const initializeAuth = async (): Promise<void> => {
  const authStateService = AuthenticationStateService.getInstance();
  const userStateService = UserStateService.getInstance();

  // Load token from persistent storage
  authStateService.loadToken();
  const token = authStateService.getToken();

  if (!token) {
    console.debug("No token found, user needs to login");
    return;
  }

  // Validate and refresh the token
  const authService = FirebaseEmailAuthenticationService.getInstance();

  try {
    // Check if the provider session is still valid
    const isSessionValid = await authService.isProviderSessionValid();

    if (!isSessionValid) {
      console.debug("Provider session is not valid, clearing auth state");
      authStateService.clearUser();
      userStateService.clearUserState();
      return;
    }

    // Try to refresh the token
    await authService.refreshToken();

    // Get the user from the refreshed token
    const refreshedToken = authStateService.getToken();
    if (refreshedToken) {
      const user = authService.getUser(refreshedToken);
      if (user) {
        authStateService.setUser(user);

        // Fetch and populate user state with access role
        try {
          const firebaseErrorFactory = getFirebaseErrorFactory("App", "initializeAuth");
          const firebaseUser = await StdFirebaseAuthenticationService.getInstance().getCurrentUser();
          if (!firebaseUser) throw new Error("No current firebase user");
          const accessRole = await authService.getAccessRole(firebaseUser, firebaseErrorFactory);
          userStateService.setUserState({
            id: user.id,
            name: user.name,
            email: user.email,
            accessRole,
          });
          console.debug("Auth initialized successfully for user:", user.email);
        } catch (accessRoleError) {
          console.error("Error fetching access role:", accessRoleError);
          // Clear auth state if we can't get the access role
          authStateService.clearUser();
          userStateService.clearUserState();
        }
      } else {
        console.debug("Could not get user from token, clearing auth state");
        authStateService.clearUser();
        userStateService.clearUserState();
      }
    }
  } catch (error) {
    console.error("Error initializing auth:", error);
    authStateService.clearUser();
    userStateService.clearUserState();
  }
};

function App() {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeAuth();
      } catch (error) {
        console.error("Failed to initialize auth:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    init();
  }, []);

  if (isInitializing) {
    return <LoadingScreen />;
  }

  return <RouterProvider router={router} />;
}

export default App;
