import { useCallback, useContext, useEffect, useState } from "react";
import { ReconnectVersionContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import JobService from "src/jobMatching/services/JobService";
import type { JobApiDocument, JobFilters, JobRow, JobSortDir, JobSortKey } from "src/jobMatching/types";

const PAGE_SIZE = 20;

let _rowCounter = 0;
const nextId = () => String(++_rowCounter);

function mapDocToRow(doc: JobApiDocument): JobRow {
  return {
    id: nextId(),
    jobTitle: doc.title ?? "",
    company: doc.employer ?? "",
    category: doc.category ?? "",
    employmentType: doc.employment_type ?? "",
    location: doc.location ?? "",
    posted: doc.posted_date ?? "",
    jobUrl: doc.application_url ?? undefined,
    skills: Array.isArray(doc.skills) ? doc.skills : undefined,
  };
}

const mapSortKeyToApiField = (key: JobSortKey): "title" | "category" | "location" | "posted_date" => {
  const keyMap: Record<JobSortKey, "title" | "category" | "location" | "posted_date"> = {
    jobTitle: "title",
    category: "category",
    location: "location",
    posted: "posted_date",
  };
  return keyMap[key];
};

export interface UseJobsResult {
  jobs: JobRow[];
  loading: boolean;
  error: unknown;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  page: number;
  sortKey: JobSortKey | null;
  sortDir: JobSortDir;
  onSortChange: (key: JobSortKey, dir?: JobSortDir) => void;
  onSortClear: () => void;
  goToNextPage: () => void;
  goToPrevPage: () => void;
  reload: () => void;
}

export function useJobs(filters: JobFilters): UseJobsResult {
  const reconnectVersion = useContext(ReconnectVersionContext);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [sortKey, setSortKey] = useState<JobSortKey | null>("posted");
  const [sortDir, setSortDir] = useState<JobSortDir>("desc");

  // Reset to page 0 when filters or sort options change
  useEffect(() => {
    setCursorStack([undefined]);
    setPageIndex(0);
    setNextCursor(null);
  }, [filters.search, filters.category, filters.employmentType, filters.location, sortKey, sortDir]);

  useEffect(() => {
    const cursor = cursorStack[pageIndex];
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const searchValue = filters.search.trim();
        const result = await JobService.getInstance().listJobs({
          search: searchValue.length > 0 ? searchValue : undefined,
          category: filters.category === "all" ? undefined : filters.category,
          employment_type: filters.employmentType === "all" ? undefined : filters.employmentType,
          location: filters.location === "all" ? undefined : filters.location,
          cursor,
          limit: PAGE_SIZE,
          ...(sortKey ? { sort_by: mapSortKeyToApiField(sortKey), sort_dir: sortDir } : {}),
        });
        if (!cancelled) {
          setJobs(result.data.map(mapDocToRow));
          setNextCursor(result.meta.next_cursor);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e);
          setJobs([]);
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
  }, [
    cursorStack,
    pageIndex,
    filters.search,
    filters.category,
    filters.employmentType,
    filters.location,
    sortKey,
    sortDir,
    reconnectVersion,
  ]);

  const onSortChange = useCallback((key: JobSortKey, dir?: JobSortDir) => {
    setSortKey((prevKey) => {
      const isSameKey = prevKey === key;
      if (dir) {
        setSortDir(dir);
      } else if (isSameKey) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
      } else {
        setSortDir("asc");
      }
      return key;
    });
  }, []);

  const onSortClear = useCallback(() => {
    setSortKey(null);
    setSortDir("asc");
  }, []);

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

  const reload = useCallback(() => {
    setCursorStack([undefined]);
    setPageIndex(0);
  }, []);

  return {
    jobs,
    loading,
    error,
    hasNextPage: Boolean(nextCursor),
    hasPrevPage: pageIndex > 0,
    page: pageIndex + 1,
    sortKey,
    sortDir,
    onSortChange,
    onSortClear,
    goToNextPage,
    goToPrevPage,
    reload,
  };
}
