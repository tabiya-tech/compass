import { useEffect, useState } from "react";
import AnalyticsService from "src/analytics/AnalyticsService";
import type { JobDemandStatsResponse } from "src/analytics/AnalyticsService.types";

export interface UseJobDemandStatsResult {
  data: JobDemandStatsResponse | null;
  loading: boolean;
  error: Error | null;
}

export function useJobDemandStats(limit = 10, location?: string): UseJobDemandStatsResult {
  const [data, setData] = useState<JobDemandStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    AnalyticsService.getInstance()
      .getJobDemandStats(limit, location)
      .then((result) => {
        if (!isMounted) return;
        setData(result);
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
  }, [limit, location]);

  return { data, loading, error };
}
