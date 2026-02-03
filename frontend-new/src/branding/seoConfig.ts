import { EnvError } from "src/error/commonErrors";
import { getSeoEnvVar } from "src/envService";

/**
 * Reads SEO overrides from the FRONTEND_SEO env var.
 *
 * The env var should be a JSON string with optional fields:
 * - name: site or app name
 * - url: canonical URL
 * - image: default preview image
 * - description: site or app description
 *
 * Returns a `SeoConfig` object, or an empty object if missing/invalid.
 */
export type SeoConfig = {
  name?: string;
  url?: string;
  image?: string;
  description?: string;
};

const readStringField = (obj: Record<string, unknown>, key: keyof SeoConfig): string | undefined => {
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
};

export const getSeoConfig = (): SeoConfig => {
  const raw = getSeoEnvVar();
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const obj = parsed as Record<string, unknown>;
    const keys: Array<keyof SeoConfig> = ["name", "url", "image", "description"];

    return keys.reduce<SeoConfig>((acc, key) => {
      const value = readStringField(obj, key);
      if (value) acc[key] = value;
      return acc;
    }, {});
  } catch (e) {
    console.error(new EnvError("Error parsing FRONTEND_SEO env var", e));
    return {};
  }
};
