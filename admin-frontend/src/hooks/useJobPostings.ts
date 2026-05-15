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
  posted_date?: string;
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
    postedDate: doc.posted_date,
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
  page: number;
  totalItems: number;
  totalPages: number;
  goToPage: (page: number) => void;
  onSortChange: (key: keyof JobPostingRow, dir?: "asc" | "desc") => void;
  onSortClear: () => void;
}

export interface JobPostingQueryFilters {
  searchQuery: string;
  sectorQuery?: string;
  locationQuery?: string;
  skillsQuery?: string;
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
  skillsQuery = "",
}: JobPostingQueryFilters): UseJobPostingsResult {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof JobPostingRow | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [rows, setRows] = useState<JobPostingRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [stats, setStats] = useState<JobPostingStats>({ jobsSourced: 0, sectorsCovered: 0, sourcePlatformsCount: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const normalizedSearchQuery = searchQuery.trim();
  const normalizedSectorQuery = sectorQuery.trim();
  const normalizedLocationQuery = locationQuery.trim();
  const normalizedSkillsQuery = skillsQuery.trim();

  useEffect(() => {
    setPage(1);
  }, [normalizedSearchQuery, normalizedSectorQuery, normalizedLocationQuery, normalizedSkillsQuery]);

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
          skills: normalizedSkillsQuery || undefined,
          page,
          limit: PAGE_SIZE,
          include: "count",
          ...(apiSortBy ? { sort_by: apiSortBy, sort_dir: sortDir } : {}),
        });
        if (!cancelled) {
          setRows(result.data.map(mapToRow));
          if (typeof result.meta.total === "number") {
            setTotalItems(result.meta.total);
            setTotalPages(Math.max(1, Math.ceil(result.meta.total / PAGE_SIZE)));
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    page,
    sortDir,
    sortKey,
    normalizedSearchQuery,
    normalizedSectorQuery,
    normalizedLocationQuery,
    normalizedSkillsQuery,
  ]);

  const goToPage = useCallback(
    (nextPage: number) => {
      if (!Number.isInteger(nextPage)) return;
      setPage(Math.min(Math.max(1, nextPage), totalPages));
    },
    [totalPages]
  );

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
    setPage(1);
  }, []);

  const onSortClear = useCallback(() => {
    setSortKey(null);
    setSortDir("asc");
    setPage(1);
  }, []);

  return {
    rows,
    stats,
    loading,
    statsLoading,
    error,
    sortKey,
    sortDir,
    page,
    totalItems,
    totalPages,
    goToPage,
    onSortChange,
    onSortClear,
  };
}
