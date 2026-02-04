import { getBrowserTabTitle, getMetaDescription } from "src/envService";
import { getSeoConfig, SeoConfig } from "src/branding/seoConfig";

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
 * This includes the browser tab title, Meta description, and JSON-LD structured data.
 * Only the variables that are provided in the environment are applied.
 */
export const applyBrandingFromEnv = (): void => {
  // Browser tab title
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

  // JSON-LD structured data overrides.
  updateJsonLd(getSeoConfig(), document.title);
};
