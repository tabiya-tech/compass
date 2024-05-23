// Based on https://testing-library.com/docs/react-testing-library/setup/

import React, { ReactElement } from "react";
import { render, renderHook, RenderHookOptions, RenderOptions } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import applicationTheme, { ThemeMode } from "src/theme/applicationTheme/applicationTheme";

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <ThemeProvider theme={applicationTheme(ThemeMode.LIGHT)}>{children}</ThemeProvider>;
};

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
  render(ui, { wrapper: AllTheProviders, ...options });

function customRenderHook<T>(hook: () => T, options?: Omit<RenderHookOptions<T>, "wrapper">) {
  return renderHook(hook, { wrapper: AllTheProviders, ...options });
}

export * from "@testing-library/react";
export { customRender as render };
export { customRenderHook as renderHook };
