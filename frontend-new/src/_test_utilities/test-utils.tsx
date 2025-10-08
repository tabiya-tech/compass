// Based on https://testing-library.com/docs/react-testing-library/setup/
import React, { ReactElement, ReactNode } from "react";
import { render, renderHook, RenderHookOptions, RenderOptions } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
// Ensure i18n is initialized for tests using translation hooks / Trans components
import "src/i18n/i18n";
import applicationTheme, { ThemeMode } from "src/theme/applicationTheme/applicationTheme";

import SnackbarProvider from "src/theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineProvider } from "src/app/isOnlineProvider/IsOnlineProvider";
import { HashRouter } from "react-router-dom";

export const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <IsOnlineProvider>
      <ThemeProvider theme={applicationTheme(ThemeMode.LIGHT)}>
        <SnackbarProvider>{children}</SnackbarProvider>
      </ThemeProvider>
    </IsOnlineProvider>
  );
};
// Wrap all tests by default in a hash router and all the providers
// if a specific test does not need the router, it can pass router=false
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { wrapper?: React.ComponentType }
) => {
  const PassedWrapper = options?.wrapper ?? React.Fragment;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllTheProviders>
      <HashRouter>
        <PassedWrapper>{children}</PassedWrapper>
      </HashRouter>
    </AllTheProviders>
  );

  return render(ui, { wrapper: wrapper, ...options });
};

function customRenderHook<T>(
  hook: () => T,
  options?: Omit<RenderHookOptions<T>, "wrapper"> & { wrapper?: React.ComponentType }
) {
  const CombinedWrapper = ({ children }: { children: ReactNode }) => {
    const Wrapper = options?.wrapper ?? React.Fragment;
    return (
      <AllTheProviders>
        <HashRouter>
          <Wrapper>{children}</Wrapper>
        </HashRouter>
      </AllTheProviders>
    );
  };

  return renderHook(hook, { wrapper: CombinedWrapper, ...options });
}

export * from "@testing-library/react";
export * from "@testing-library/user-event";
export { customRender as render };
export { customRenderHook as renderHook };
