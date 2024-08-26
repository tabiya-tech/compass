// Based on https://testing-library.com/docs/react-testing-library/setup/
import React, { ReactElement, ReactNode } from "react";
import { render, renderHook, RenderHookOptions, RenderOptions } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import applicationTheme, { ThemeMode } from "src/theme/applicationTheme/applicationTheme";

// Import the Firebase mock utilities
import "src/_test_utilities/firebaseMock";
import SnackbarProvider from "src/theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineProvider } from "src/app/isOnlineProvider/IsOnlineProvider";
import { AuthContext } from "src/auth/AuthProvider";
jest.mock("firebase/compat/app", () => {
  return {
    initializeApp: jest.fn(),
    auth: jest.fn().mockReturnValue({
      signOut: jest.fn(),
      currentUser: {
        getIdToken: jest.fn(),
        getTokenResult: jest.fn(),
      },
      onAuthStateChanged: jest.fn().mockReturnValue(jest.fn()),
      signInWithPopup: jest.fn(),
      GoogleAuthProvider: { PROVIDER_ID: "google.com" },
    }),
  };
});

jest.mock("firebaseui", () => {
  return {
    auth: {
      AuthUI: {
        start: jest.fn(),
        getInstance: jest.fn().mockReturnValue({
          start: jest.fn(),
          reset: jest.fn(),
        }),
        reset: jest.fn(),
      },
    },
  };
});
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const defaultAuthContextValue = {
    user: null,
    updateUserByToken: () => null,
    clearUser: () => {},
    isAuthenticationInProgress: false,
    isAuthenticated: false,
  }
  return (
    <IsOnlineProvider>
      <ThemeProvider theme={applicationTheme(ThemeMode.LIGHT)}>
        <AuthContext.Provider value={defaultAuthContextValue}>
          <SnackbarProvider>{children}</SnackbarProvider>
        </AuthContext.Provider>
      </ThemeProvider>
    </IsOnlineProvider>
  );
};

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
  render(ui, { wrapper: AllTheProviders, ...options });

function customRenderHook<T>(
  hook: () => T,
  options?: Omit<RenderHookOptions<T>, "wrapper"> & { wrapper?: React.ComponentType }
) {
  const CombinedWrapper = ({ children }: { children: ReactNode }) => {
    const Wrapper = options?.wrapper ?? React.Fragment;
    return (
      <AllTheProviders>
        <Wrapper>{children}</Wrapper>
      </AllTheProviders>
    );
  };

  return renderHook(hook, { wrapper: CombinedWrapper, ...options });
}

export * from "@testing-library/react";
export { customRender as render };
export { customRenderHook as renderHook };
