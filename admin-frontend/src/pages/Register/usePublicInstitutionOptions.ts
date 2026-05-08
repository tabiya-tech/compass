import { useEffect, useState } from "react";
import { getBackendUrl } from "src/envService";
import type { InstitutionApiItem } from "src/analytics/AnalyticsService.types";
import { encodeInstitutionId } from "src/utils/institutionUtils";

interface PublicInstitution {
  id?: string;
  reg_no?: string;
  name: string;
}

interface PublicInstitutionsResponse {
  data: PublicInstitution[];
  meta: { next_cursor: string | null };
}

/**
 * Fetches the full list of institutions from the public /institutions endpoint.
 * Used by the public Register page (no auth available).
 */
export function usePublicInstitutionOptions() {
  const [options, setOptions] = useState<InstitutionApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchAll() {
      setLoading(true);
      const items: InstitutionApiItem[] = [];
      let cursor: string | undefined;
      const base = getBackendUrl();

      try {
        do {
          const params = new URLSearchParams({ limit: "500", fields: "name" });
          if (cursor) params.set("cursor", cursor);
          const response = await fetch(`${base}/institutions?${params}`);
          if (!response.ok) {
            throw new Error(`Failed to load institutions (${response.status})`);
          }
          const body = (await response.json()) as PublicInstitutionsResponse;
          for (const inst of body.data) {
            // The id MUST be the base64url-encoded institution name — it lands in
            // Firebase token claims and is later decoded server-side and client-side
            // to render the institution name in the instructor dashboard.
            items.push({
              id: encodeInstitutionId(inst.name),
              name: inst.name,
              active: true,
              students: null,
              active_7_days: null,
              skills_discovery_started_pct: null,
              skills_discovery_completed_pct: null,
              career_readiness_started_pct: null,
            } as InstitutionApiItem);
          }
          cursor = body.meta?.next_cursor ?? undefined;
        } while (cursor);

        if (isMounted) {
          setOptions(items.sort((a, b) => a.name.localeCompare(b.name)));
          setError(null);
        }
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchAll();

    return () => {
      isMounted = false;
    };
  }, []);

  return { options, loading, error };
}
