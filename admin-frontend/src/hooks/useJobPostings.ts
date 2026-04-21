import { useCallback, useEffect, useState } from "react";
import AnalyticsService from "src/analytics/AnalyticsService";
import type { JobPostingRow, JobPostingStats } from "src/types";

const PAGE_SIZE = 20;

let _counter = 0;
const nextId = () => String(++_counter);

const normalizeOptionalText = (value?: string): string | null => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

function mapToRow(doc: {
  title?: string;
  category?: string;
  location?: string;
  application_url?: string;
  source_platform?: string;
  skills?: string[];
}): JobPostingRow {
  return {
    id: nextId(),
    jobTitle: normalizeOptionalText(doc.title),
    sector: normalizeOptionalText(doc.category),
    location: normalizeOptionalText(doc.location),
    zqfLevel: "",
    platform: normalizeOptionalText(doc.source_platform),
    skills: Array.isArray(doc.skills) ? doc.skills : [],
    candidatePool: 0,
    jobUrl: doc.application_url ?? "",
  };
}

export interface UseJobPostingsResult {
  rows: JobPostingRow[];
  stats: JobPostingStats;
  loading: boolean;
  statsLoading: boolean;
  error: Error | null;
  sortKey: keyof JobPostingRow | null;
  sortDir: "asc" | "desc";
  hasNextPage: boolean;
  hasPrevPage: boolean;
  page: number;
  goToNextPage: () => void;
  goToPrevPage: () => void;
  onSortChange: (key: keyof JobPostingRow, dir?: "asc" | "desc") => void;
  onSortClear: () => void;
}

export interface JobPostingQueryFilters {
  searchQuery: string;
  sectorQuery?: string;
  locationQuery?: string;
}

function mapSortKeyToApiField(key: keyof JobPostingRow): "title" | "category" | "location" | "source_platform" | null {
  const map: Partial<Record<keyof JobPostingRow, "title" | "category" | "location" | "source_platform">> = {
    jobTitle: "title",
    sector: "category",
    location: "location",
    platform: "source_platform",
  };
  return map[key] ?? null;
}

export function useJobPostings({
  searchQuery,
  sectorQuery = "",
  locationQuery = "",
}: JobPostingQueryFilters): UseJobPostingsResult {
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [sortKey, setSortKey] = useState<keyof JobPostingRow | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [rows, setRows] = useState<JobPostingRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [stats, setStats] = useState<JobPostingStats>({ jobsSourced: 0, sectorsCovered: 0, sourcePlatformsCount: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const normalizedSearchQuery = searchQuery.trim();
  const normalizedSectorQuery = sectorQuery.trim();
  const normalizedLocationQuery = locationQuery.trim();

  useEffect(() => {
    setCursorStack([undefined]);
    setPageIndex(0);
    setNextCursor(null);
  }, [normalizedSearchQuery, normalizedSectorQuery, normalizedLocationQuery]);

  // Fetch stats once
  useEffect(() => {
    let isMounted = true;
    setStatsLoading(true);
    AnalyticsService.getInstance()
      .getJobStats()
      .then((data) => {
        if (!isMounted) return;
        setStats({ jobsSourced: data.total, sectorsCovered: data.sectors, sourcePlatformsCount: data.platforms });
      })
      .catch(() => {
        /* stats are non-critical, silently ignore */
      })
      .finally(() => {
        if (isMounted) setStatsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch current page
  useEffect(() => {
    const cursor = cursorStack[pageIndex];
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiSortBy = sortKey ? mapSortKeyToApiField(sortKey) : null;
        const result = await AnalyticsService.getInstance().listJobs({
          search: normalizedSearchQuery || undefined,
          category: normalizedSectorQuery || undefined,
          location: normalizedLocationQuery || undefined,
          cursor,
          limit: PAGE_SIZE,
          ...(apiSortBy ? { sort_by: apiSortBy, sort_dir: sortDir } : {}),
        });
        if (!cancelled) {
          const mappedRows = result.data.map(mapToRow);
          setRows(mappedRows);
          setNextCursor(result.meta.next_cursor);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setRows([]);
          setNextCursor(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [cursorStack, pageIndex, sortDir, sortKey, normalizedSearchQuery, normalizedSectorQuery, normalizedLocationQuery]);

  const goToNextPage = useCallback(() => {
    if (!nextCursor) return;
    setCursorStack((prev) => {
      const updated = [...prev];
      updated[pageIndex + 1] = nextCursor;
      return updated;
    });
    setPageIndex((p) => p + 1);
  }, [nextCursor, pageIndex]);

  const goToPrevPage = useCallback(() => {
    setPageIndex((p) => Math.max(0, p - 1));
  }, []);

  const onSortChange = useCallback((key: keyof JobPostingRow, dir?: "asc" | "desc") => {
    if (!mapSortKeyToApiField(key)) return;
    setSortKey((prevKey) => {
      const isSameKey = prevKey !== null && prevKey === key;
      if (dir) {
        setSortDir(dir);
      } else {
        setSortDir((prevDir) => (isSameKey ? (prevDir === "asc" ? "desc" : "asc") : "asc"));
      }
      return key;
    });
    setCursorStack([undefined]);
    setPageIndex(0);
    setNextCursor(null);
  }, []);

  const onSortClear = useCallback(() => {
    setSortKey(null);
    setCursorStack([undefined]);
    setPageIndex(0);
    setNextCursor(null);
  }, []);

  return {
    rows,
    stats,
    loading,
    statsLoading,
    error,
    sortKey,
    sortDir,
    hasNextPage: Boolean(nextCursor),
    hasPrevPage: pageIndex > 0,
    page: pageIndex + 1,
    goToNextPage,
    goToPrevPage,
    onSortChange,
    onSortClear,
  };
}
