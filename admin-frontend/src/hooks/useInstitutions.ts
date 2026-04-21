import React, { useCallback, useEffect, useState } from "react";
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
  hasNextPage: boolean;
  hasPrevPage: boolean;
  goToNextPage: () => void;
  goToPrevPage: () => void;
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
  // cursor stack: index 0 = page 1 (no cursor), index N = cursor for page N+1
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [sortKey, setSortKey] = useState<keyof InstitutionRow | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [institutions, setInstitutions] = useState<InstitutionRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const cursorStackRef = React.useRef(cursorStack);
  cursorStackRef.current = cursorStack;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    const cursor = cursorStackRef.current[pageIndex];
    const apiSortBy = sortKey ? mapSortKeyToApiField(sortKey) : undefined;
    AnalyticsService.getInstance()
      .listInstitutions(PAGE_SIZE, cursor, apiSortBy, sortKey ? sortDir : undefined)
      .then((data) => {
        if (!isMounted) return;
        setInstitutions(data.data.map(mapApiItemToRow));
        setNextCursor(data.meta.next_cursor);
        setError(null);
        // Push the next cursor onto the stack if we don't already have it
        if (data.meta.next_cursor) {
          setCursorStack((prev) => {
            if (prev.length <= pageIndex + 1) {
              return [...prev, data.meta.next_cursor!];
            }
            return prev;
          });
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
  }, [pageIndex, sortDir, sortKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const goToNextPage = useCallback(() => {
    if (nextCursor) setPageIndex((p) => p + 1);
  }, [nextCursor]);

  const goToPrevPage = useCallback(() => {
    setPageIndex((p) => Math.max(0, p - 1));
  }, []);

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
    setPageIndex(0);
    setCursorStack([undefined]);
    setNextCursor(null);
  }, []);

  const onSortClear = useCallback(() => {
    setSortKey(null);
    setPageIndex(0);
    setCursorStack([undefined]);
    setNextCursor(null);
  }, []);

  return {
    institutions,
    loading,
    error,
    page: pageIndex + 1,
    sortKey,
    sortDir,
    hasNextPage: Boolean(nextCursor),
    hasPrevPage: pageIndex > 0,
    goToNextPage,
    goToPrevPage,
    onSortChange,
    onSortClear,
  };
}
