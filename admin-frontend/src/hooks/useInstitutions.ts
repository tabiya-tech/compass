import { useCallback, useEffect, useState } from "react";
import type { InstitutionRow } from "src/types";
import AnalyticsService from "src/analytics/AnalyticsService";
import type { InstitutionApiItem } from "src/analytics/AnalyticsService.types";

const PAGE_SIZE = 20;

export interface UseInstitutionsResult {
  institutions: InstitutionRow[];
  loading: boolean;
  error: Error | null;
  page: number;
  sortKey: keyof InstitutionRow | null;
  sortDir: "asc" | "desc";
  totalItems: number;
  totalPages: number;
  goToPage: (page: number) => void;
  onSortChange: (key: keyof InstitutionRow, dir?: "asc" | "desc") => void;
  onSortClear: () => void;
}

function mapApiItemToRow(item: InstitutionApiItem): InstitutionRow {
  return {
    id: item.id,
    institution: item.name,
    students: item.students,
    active7Days: item.active_7_days,
    skillsDiscoveryStartedPct: item.skills_discovery_started_pct,
    skillsDiscoveryCompletedPct: item.skills_discovery_completed_pct,
    careerReadinessStartedPct: item.career_readiness_started_pct,
    careerReadinessCompletedPct: item.career_readiness_completed_pct,
    careerExplorerStartedPct: item.career_explorer_started_pct,
  };
}

function mapSortKeyToApiField(key: keyof InstitutionRow): string {
  const keyMap: Record<keyof InstitutionRow, string> = {
    id: "name",
    institution: "name",
    students: "students",
    active7Days: "active_7_days",
    skillsDiscoveryStartedPct: "skills_discovery_started_pct",
    skillsDiscoveryCompletedPct: "skills_discovery_completed_pct",
    careerReadinessStartedPct: "career_readiness_started_pct",
    careerReadinessCompletedPct: "career_readiness_completed_pct",
    careerExplorerStartedPct: "career_explorer_started_pct",
  };
  return keyMap[key];
}

export function useInstitutions(): UseInstitutionsResult {
  const [page, setPage] = useState(1);
  const [institutions, setInstitutions] = useState<InstitutionRow[]>([]);
  const [sortKey, setSortKey] = useState<keyof InstitutionRow | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    const apiSortBy = sortKey ? mapSortKeyToApiField(sortKey) : undefined;
    AnalyticsService.getInstance()
      .listInstitutions(PAGE_SIZE, undefined, apiSortBy, sortKey ? sortDir : undefined, { page, includeCount: true })
      .then((data) => {
        if (!isMounted) return;
        setInstitutions(data.data.map(mapApiItemToRow));
        if (typeof data.meta.total === "number") {
          setTotalItems(data.meta.total);
          setTotalPages(Math.max(1, Math.ceil(data.meta.total / PAGE_SIZE)));
        }
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
  }, [page, sortDir, sortKey]);

  const goToPage = useCallback(
    (nextPage: number) => {
      if (!Number.isInteger(nextPage)) return;
      setPage(Math.min(Math.max(1, nextPage), totalPages));
    },
    [totalPages]
  );

  const onSortChange = useCallback((key: keyof InstitutionRow, dir?: "asc" | "desc") => {
    setSortKey((prevSortKey) => {
      const isSameKey = prevSortKey !== null && prevSortKey === key;
      if (dir) {
        setSortDir(dir);
      } else {
        setSortDir((prevDir) => (isSameKey ? (prevDir === "asc" ? "desc" : "asc") : "asc"));
      }
      return key;
    });
    setPage(1);
  }, []);

  const onSortClear = useCallback(() => {
    setSortKey(null);
    setSortDir("asc");
    setPage(1);
  }, []);

  return {
    institutions,
    loading,
    error,
    page,
    sortKey,
    sortDir,
    totalItems,
    totalPages,
    goToPage,
    onSortChange,
    onSortClear,
  };
}
