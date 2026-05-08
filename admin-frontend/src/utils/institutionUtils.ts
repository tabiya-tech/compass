/**
 * Decodes a base64url-encoded institution ID to the institution name.
 * The institution ID is produced by base64url-encoding the institution name
 * (with padding stripped), matching the backend encoding in analytics/institutions/repository.py.
 */
export function decodeInstitutionId(institutionId: string): string {
  // Re-add stripped base64 padding
  const padded = institutionId + "=".repeat((4 - (institutionId.length % 4)) % 4);
  // Replace URL-safe chars back to standard base64
  const standard = padded.replace(/-/g, "+").replace(/_/g, "/");
  return atob(standard);
}

/**
 * Encodes an institution name to its base64url ID form (the inverse of decodeInstitutionId).
 * Mirror of `base64.urlsafe_b64encode(name.encode()).decode().rstrip("=")` in Python.
 */
export function encodeInstitutionId(name: string): string {
  // UTF-8 → binary string suitable for btoa(). encodeURIComponent + unescape
  // is the standard, universally-supported pattern (works in jsdom too, where
  // TextEncoder is not always available).
  const binary = unescape(encodeURIComponent(name));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
