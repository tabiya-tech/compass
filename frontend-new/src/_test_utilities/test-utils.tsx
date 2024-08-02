// Based on https://testing-library.com/docs/react-testing-library/setup/
import React, { ReactElement, ReactNode } from "react";
import { render, renderHook, RenderHookOptions, RenderOptions } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import applicationTheme, { ThemeMode } from "src/theme/applicationTheme/applicationTheme";
import { EmailAuthProvider } from "src/auth/emailAuth/EmailAuthProvider/EmailAuthProvider";
import { AnonymousAuthProvider } from "src/auth/anonymousAuth/AnonymousAuthProvider/AnonymousAuthProvider";

// Import the Firebase mock utilities
import "src/_test_utilities/firebaseMock";
import SnackbarProvider from "src/theme/SnackbarProvider/SnackbarProvider";
import { UserPreferencesProvider } from "src/userPreferences/UserPreferencesProvider/UserPreferencesProvider";
import { IsOnlineProvider } from "src/app/isOnlineProvider/IsOnlineProvider";
import { InvitationsProvider } from "src/invitations/InvitationsProvider/InvitationsProvider";

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <IsOnlineProvider>
      <ThemeProvider theme={applicationTheme(ThemeMode.LIGHT)}>
        <AnonymousAuthProvider>
          <EmailAuthProvider>
            <UserPreferencesProvider>
              <InvitationsProvider>
                <SnackbarProvider>{children}</SnackbarProvider>
              </InvitationsProvider>
            </UserPreferencesProvider>
          </EmailAuthProvider>
        </AnonymousAuthProvider>
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
