import { useEffect, useState } from "react";
import InstitutionService from "src/institutions/InstitutionService";

export interface InstitutionFilterOptions {
  institutionNames: string[];
  loading: boolean;
  error: Error | null;
}

/**
 * Fetches all institutions from the backend collection and returns a sorted
 * list of unique institution names for use in dashboard filter dropdowns.
 * Paginates through all pages automatically.
 */
export function useInstitutionFilterOptions(): InstitutionFilterOptions {
  const [institutionNames, setInstitutionNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchAll() {
      setLoading(true);
      try {
        const result = await InstitutionService.getInstance().searchInstitutions({
          limit: 100,
          fields: "name",
        });
        if (isMounted) {
          setInstitutionNames(result.data.map((i) => i.name).sort());
          setError(null);
        }
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchAll();

    return () => {
      isMounted = false;
    };
  }, []);

  return { institutionNames, loading, error };
}
