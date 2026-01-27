import {
  getBrowserTabTitle,
  getFaviconUrl,
  getLogoUrl,
  getProductName,
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

  document.title = browserTabTitle;
  setFavicon(faviconUrl);
};
