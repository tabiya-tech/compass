import { useEffect, useState } from "react";
import AnalyticsService from "src/analytics/AnalyticsService";

export interface UseSkillsAnalyticsFilterOptionsResult {
  sectors: string[];
  loading: boolean;
  error: Error | null;
}

export function useSkillsAnalyticsFilterOptions(): UseSkillsAnalyticsFilterOptionsResult {
  const [sectors, setSectors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    AnalyticsService.getInstance()
      .getInstitutionFilterOptions()
      .then((result) => {
        if (!isMounted) return;
        setSectors(result.sectors);
        setError(null);
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

  return { sectors, loading, error };
}
