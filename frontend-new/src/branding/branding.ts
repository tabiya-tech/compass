import {
  getAppIconUrl,
  getBrowserTabTitle,
  getMetaDescription,
  getFaviconUrl,
  getThemeCssVariables,
} from "src/envService";
import { getSeoConfig, SeoConfig } from "src/branding/seoConfig";

const setCssVar = (name: string, value: string) => {
  document.documentElement.style.setProperty(name, value);
};

const upsertLinkHref = (rel: string, href: string) => {
  if (!href) return;

  const existing = document.querySelector(`link[rel='${rel}']`);
  if (existing instanceof HTMLLinkElement) {
    existing.href = href;
    return;
  }

  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  document.head.appendChild(link);
};

const updateJsonLd = (seo: SeoConfig, browserTabTitle: string) => {
  const jsonLdScript = document.getElementById("seo-jsonld");
  if (!(jsonLdScript instanceof HTMLScriptElement) || !jsonLdScript.textContent) return;

  try {
    const data = JSON.parse(jsonLdScript.textContent);

    if (seo.name || browserTabTitle) data.name = seo.name || browserTabTitle;
    if (seo.url) data.url = seo.url;
    if (seo.image) data.image = seo.image;
    if (seo.description) data.description = seo.description;

    jsonLdScript.textContent = JSON.stringify(data);
  } catch (e) {
    console.error(e);
    // Ignore bad JSON-LD; keep the default that shipped in index.html.
  }
};

/**
 * Apply branding overrides from environment variables.
 * This includes theme CSS variables, browser tab title, Meta description, and JSON-LD structured data.
 * Only the variables that are provided in the environment are applied.
 */
export const applyBrandingFromEnv = (): void => {
  // Theme variables (colors/text). We only set variables that are provided.
  const themeCssVariables = getThemeCssVariables();
  Object.entries(themeCssVariables).forEach(([key, value]) => {
    if (value) {
      setCssVar(`--${key}`, value);
    }
  });

  // Browser tab title.
  const browserTabTitle = getBrowserTabTitle();
  if (browserTabTitle) {
    document.title = browserTabTitle;
  } else {
    console.warn("Browser tab title not set, keeping the default");
  }

  // Meta description
  const description = getMetaDescription();
  if (description) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta instanceof HTMLMetaElement) {
      meta.content = description;
    }
  } else {
    console.warn("Meta description not set, keeping the default");
  }

  // Icons.
  const faviconUrl = getFaviconUrl();
  if (faviconUrl) {
    upsertLinkHref("icon", faviconUrl);
  }

  const appIconUrl = getAppIconUrl();
  if (appIconUrl) {
    upsertLinkHref("apple-touch-icon", appIconUrl);
  }

  // JSON-LD structured data overrides.
  updateJsonLd(getSeoConfig(), document.title);
};
