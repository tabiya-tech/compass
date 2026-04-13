import { EnvVariables, getEnv } from "src/envService";

/**
 * Hash paths for in-app legal routes on the learner app (frontend-new).
 * Keep in sync with `frontend-new` `routerPaths.PRIVACY_POLICY` / `TERMS_OF_USE`.
 */
export const LEGAL_DOCUMENT_ROUTE_PATHS = {
  PRIVACY_POLICY: "/privacy-policy",
  TERMS_OF_USE: "/terms-of-use",
} as const;

export type LegalDocumentRoutePath = (typeof LEGAL_DOCUMENT_ROUTE_PATHS)[keyof typeof LEGAL_DOCUMENT_ROUTE_PATHS];

export function getLegalSiteBaseUrl(): string {
  const configured = getEnv(EnvVariables.LEGAL_SITE_BASE_URL).replace(/\/$/, "");
  if (configured) {
    return configured;
  }
  if (typeof window !== "undefined") {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "LEGAL_SITE_BASE_URL is not set; using window.location.origin for legal footer links. " +
          "Set LEGAL_SITE_BASE_URL to the learner (frontend-new) public origin when admin is on a different host."
      );
    }
    return window.location.origin;
  }
  return "";
}

export function getLegalDocumentAbsoluteUrl(path: LegalDocumentRoutePath): string {
  const base = getLegalSiteBaseUrl();
  return `${base}/#${path}`;
}
