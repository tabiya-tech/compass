import { useCallback, useContext, useEffect, useState } from "react";
import { ReconnectVersionContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import JobService from "src/jobMatching/services/JobService";
import type { JobApiDocument, JobFilters, JobRow, JobSortDir, JobSortKey } from "src/jobMatching/types";

export const PAGE_SIZE = 20;

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
  page: number;
  sortKey: JobSortKey | null;
  sortDir: JobSortDir;
  onSortChange: (key: JobSortKey, dir?: JobSortDir) => void;
  onSortClear: () => void;
  totalPages: number;
  totalItems: number;
  goToPage: (page: number) => void;
  reload: () => void;
}

export function useJobs(filters: JobFilters): UseJobsResult {
  const reconnectVersion = useContext(ReconnectVersionContext);
  const [page, setPage] = useState(1);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [sortKey, setSortKey] = useState<JobSortKey | null>("posted");
  const [sortDir, setSortDir] = useState<JobSortDir>("desc");

  // Reset to first page when query context changes.
  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.category, filters.employmentType, filters.location, sortKey, sortDir]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const searchValue = filters.search.trim();
        const result = await JobService.getInstance().listJobs({
          search: searchValue.length > 0 ? searchValue : undefined,
          category: filters.category !== "all" ? filters.category : undefined,
          employment_type: filters.employmentType !== "all" ? filters.employmentType : undefined,
          location: filters.location !== "all" ? filters.location : undefined,
          page,
          include: "count",
          limit: PAGE_SIZE,
          ...(sortKey ? { sort_by: mapSortKeyToApiField(sortKey), sort_dir: sortDir } : {}),
        });
        if (!cancelled) {
          setJobs(result.data.map(mapDocToRow));
          if (typeof result.meta.total === "number") {
            setTotalItems(result.meta.total);
            setTotalPages(Math.max(1, Math.ceil(result.meta.total / PAGE_SIZE)));
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e);
          setJobs([]);
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

  const goToPage = useCallback(
    (nextPage: number) => {
      if (!Number.isInteger(nextPage)) return;
      setPage(Math.min(Math.max(1, nextPage), totalPages));
    },
    [totalPages]
  );

  const reload = useCallback(() => {
    setPage(1);
  }, []);

  return {
    jobs,
    loading,
    error,
    page,
    sortKey,
    sortDir,
    onSortChange,
    onSortClear,
    totalPages,
    totalItems,
    goToPage,
    reload,
  };
}
