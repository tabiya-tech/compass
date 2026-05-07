import { useEffect, useState } from "react";
import { registrationsService, RegistrationStatus } from "src/pages/Register/registrationsService";

const POLL_INTERVAL_MS = 60_000;

/**
 * Polls /admin-registrations for the pending count when the caller is allowed.
 * Returns 0 on any error (best effort, never blocks the UI).
 */
export function usePendingCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    let cancelled = false;
    const fetchCount = async () => {
      try {
        const result = await registrationsService.list(RegistrationStatus.PENDING);
        if (!cancelled) setCount(result.pending_count);
      } catch {
        if (!cancelled) setCount(0);
      }
    };

    void fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  return count;
}
