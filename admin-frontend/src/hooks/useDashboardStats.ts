import { useEffect, useState } from "react";
import type { DashboardStatItem } from "src/types";
import AnalyticsService from "src/analytics/AnalyticsService";
import type { DashboardStats } from "src/analytics/AnalyticsService.types";

export interface UseDashboardStatsResult {
  stats: DashboardStatItem[];
  loading: boolean;
  error: Error | null;
}

function mapResponseToStats(data: DashboardStats): DashboardStatItem[] {
  const pctOfRegistered =
    data.total_students > 0
      ? Math.round((Number(data.active_students_7_days) / Number(data.total_students)) * 100)
      : undefined;

  return [
    {
      id: "institutionsActive",
      titleKey: "dashboard.stats.institutionsActive",
      value: data.institutions_active,
      subtitleKey: "dashboard.stats.institutionsActiveSubtitle",
    },
    {
      id: "totalStudentsRegistered",
      titleKey: "dashboard.stats.totalStudentsRegistered",
      value: data.total_students,
    },
    {
      id: "activeStudents7Days",
      titleKey: "dashboard.stats.activeStudents7Days",
      value: data.active_students_7_days,
      subtitleKey: "dashboard.stats.activeStudents7DaysSubtitle",
      subtitleValues: pctOfRegistered === undefined ? undefined : { pct: pctOfRegistered },
    },
  ];
}

export function useDashboardStats(): UseDashboardStatsResult {
  const [stats, setStats] = useState<DashboardStatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    AnalyticsService.getInstance()
      .getDashboardStats()
      .then((data) => {
        if (isMounted) {
          setStats(mapResponseToStats(data));
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

  return { stats, loading, error };
}
