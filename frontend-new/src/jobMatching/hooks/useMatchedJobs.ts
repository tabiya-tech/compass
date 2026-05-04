import { useCallback, useContext, useEffect, useState } from "react";
import { ReconnectVersionContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import JobService from "src/jobMatching/services/JobService";
import type { JobRow, MatchedJobApiDocument } from "src/jobMatching/types";

export const MATCHED_PAGE_SIZE = 20;

let _matchedRowCounter = 0;
const nextId = () => String(++_matchedRowCounter);

function mapMatchedDocToRow(doc: MatchedJobApiDocument): JobRow {
  const score =
    typeof doc.final_score === "number" ? Math.max(0, Math.min(100, Math.round(doc.final_score * 100))) : undefined;
  return {
    id: nextId(),
    jobTitle: doc.opportunity_title ?? "",
    company: doc.employer ?? "",
    category: doc.category ?? "",
    employmentType: doc.contract_type ?? "",
    location: doc.location ?? "",
    posted: doc.posted_date ?? "",
    jobUrl: doc.URL ?? undefined,
    matchScore: score,
  };
}

export interface UseMatchedJobsResult {
  jobs: JobRow[];
  loading: boolean;
  error: unknown;
  reload: () => void;
}

/**
 * Fetches the authenticated user's matched jobs from GET /jobs/matched.
 * Only fetches when `active` is true (i.e. the Matched For You tab is selected),
 * and refetches when the reconnect version changes (network came back online).
 *
 * Returns `loading=true` until the first fetch completes when active, so the table
 * shows a skeleton on activation rather than briefly flashing the empty state.
 */
export function useMatchedJobs(active: boolean): UseMatchedJobsResult {
  const reconnectVersion = useContext(ReconnectVersionContext);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const run = async () => {
      setIsFetching(true);
      setError(null);
      try {
        const data = await JobService.getInstance().getMatchedJobs(MATCHED_PAGE_SIZE);
        if (!cancelled) {
          setJobs(data.map(mapMatchedDocToRow));
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e);
          setJobs([]);
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false);
          setHasFetched(true);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [active, reconnectVersion, reloadCounter]);

  const reload = useCallback(() => {
    setReloadCounter((n) => n + 1);
  }, []);

  // Treat the hook as loading whenever the matched tab is active and we haven't
  // yet completed a fetch (or a fetch is currently in flight). This prevents the
  // empty-state from flashing between activation and the first fetch starting.
  const loading = isFetching || (active && !hasFetched && !error);

  return { jobs, loading, error, reload };
}
