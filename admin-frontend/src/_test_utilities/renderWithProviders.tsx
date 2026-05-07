import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { MemoryRouter } from "react-router-dom";

import applicationTheme, { ThemeMode } from "src/theme/applicationTheme/applicationTheme";
import "src/i18n/i18n";

interface ProviderOptions {
  initialEntries?: string[];
}

const buildWrapper =
  ({ initialEntries }: ProviderOptions = {}): React.FC<{ children?: React.ReactNode }> =>
  ({ children }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider theme={applicationTheme(ThemeMode.LIGHT)}>{children}</ThemeProvider>
    </MemoryRouter>
  );

/**
 * Wraps the rendered tree with the providers any admin-frontend page expects:
 * MUI ThemeProvider (so theme.tabiyaSpacing/theme.tabiyaRounding resolve), MemoryRouter,
 * and the i18n bundle (translations resolve to their fallback strings).
 */
export const renderWithProviders = (
  ui: ReactElement,
  options: Omit<RenderOptions, "wrapper"> & ProviderOptions = {}
) => {
  const { initialEntries, ...renderOptions } = options;
  return render(ui, { wrapper: buildWrapper({ initialEntries }), ...renderOptions });
};
