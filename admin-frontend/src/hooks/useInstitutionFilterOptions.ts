import { useEffect, useState } from "react";
import AnalyticsService from "src/analytics/AnalyticsService";

export interface InstitutionFilterOptions {
  institutionNames: string[];
  loading: boolean;
  error: Error | null;
}

export function useInstitutionFilterOptions(): InstitutionFilterOptions {
  const [institutionNames, setInstitutionNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    AnalyticsService.getInstance()
      .getInstitutionFilterOptions()
      .then((result) => {
        if (isMounted) {
          setInstitutionNames(result.institution_names ?? []);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return { institutionNames, loading, error };
}
