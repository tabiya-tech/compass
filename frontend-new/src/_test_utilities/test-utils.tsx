// Based on https://testing-library.com/docs/react-testing-library/setup/
import React, { ReactElement } from "react";
import { render, renderHook, RenderHookOptions, RenderOptions } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import applicationTheme, { ThemeMode } from "src/theme/applicationTheme/applicationTheme";
import { AuthProvider } from "src/auth/Providers/AuthProvider/AuthProvider";

// Import the Firebase mock utilities
import "src/_test_utilities/firebaseMock";
import SnackbarProvider from "src/theme/SnackbarProvider/SnackbarProvider";
import { UserPreferencesProvider } from "src/auth/Providers/UserPreferencesProvider/UserPreferencesProvider";
import { IsOnlineProvider } from "src/app/providers/IsOnlineProvider";

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <IsOnlineProvider>
      <ThemeProvider theme={applicationTheme(ThemeMode.LIGHT)}>
        <AuthProvider>
          <UserPreferencesProvider>
            <SnackbarProvider>{children}</SnackbarProvider>
          </UserPreferencesProvider>
        </AuthProvider>
      </ThemeProvider>
    </IsOnlineProvider>
  );
};

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
  render(ui, { wrapper: AllTheProviders, ...options });

function customRenderHook<T>(hook: () => T, options?: Omit<RenderHookOptions<T>, "wrapper">) {
  return renderHook(hook, { wrapper: AllTheProviders, ...options });
}

export * from "@testing-library/react";
export { customRender as render };
export { customRenderHook as renderHook };
