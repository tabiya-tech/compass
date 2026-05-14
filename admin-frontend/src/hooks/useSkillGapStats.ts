import { useEffect, useState } from "react";
import AnalyticsService from "src/analytics/AnalyticsService";
import type { SkillGapStatsResponse } from "src/analytics/AnalyticsService.types";

export interface UseSkillGapStatsResult {
  data: SkillGapStatsResponse | null;
  loading: boolean;
  error: Error | null;
}

export function useSkillGapStats(
  limit = 10,
  institution?: string,
  location?: string,
  sector?: string
): UseSkillGapStatsResult {
  const [data, setData] = useState<SkillGapStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    AnalyticsService.getInstance()
      .getSkillGapStats(limit, institution, location, sector)
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
  }, [limit, institution, location, sector]);

  return { data, loading, error };
}
