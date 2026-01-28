import {
  getBrowserTabTitle,
  getFaviconUrl,
  getLogoUrl,
  getProductName,
  getThemeCssVariables,
} from "src/envService";

const DEFAULTS = {
  productName: "Compass",
  browserTabTitle: "Compass",
  logoUrl: "",
  faviconUrl: "",
};

const setCssVar = (name: string, value: string) => {
  document.documentElement.style.setProperty(name, value);
};

const setFavicon = (href: string) => {
  if (!href) return;

  const existing = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (existing) {
    existing.href = href;
    return;
  }

  const link = document.createElement("link");
  link.rel = "icon";
  link.href = href;
  document.head.appendChild(link);
};

/**
 * Applies branding from env.js into CSS variables and document metadata.
 *
 * This is intentionally defensive:
 * - If env values are missing, it falls back to safe defaults.
 * - CSS variables from applicationTheme are only set if provided via env vars,
 *   otherwise they fall back to values defined in variables.css
 */
export const applyBrandingFromEnv = (): void => {
  const productName = getProductName() || DEFAULTS.productName;
  const browserTabTitle = getBrowserTabTitle() || productName || DEFAULTS.browserTabTitle;

  const logoUrl = getLogoUrl() || DEFAULTS.logoUrl;
  const faviconUrl = getFaviconUrl() || DEFAULTS.faviconUrl;

  setCssVar("--platform-product-name", productName);
  setCssVar("--platform-browser-tab-title", browserTabTitle);
  setCssVar("--platform-logo-url", logoUrl);
  setCssVar("--platform-favicon-url", faviconUrl);

  const themeCssVariables = getThemeCssVariables();
  Object.entries(themeCssVariables).forEach(([key, value]) => {
    if (value) {
      setCssVar(`--${key}`, value);
    }
  });

  document.title = browserTabTitle;
  setFavicon(faviconUrl);
};
