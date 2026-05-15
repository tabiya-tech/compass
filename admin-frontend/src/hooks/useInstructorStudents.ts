import { useCallback, useEffect, useRef, useState } from "react";
import AnalyticsService from "src/analytics/AnalyticsService";
import { PLACEHOLDER_SYMBOL } from "src/constants";
import type { InstructorStudentRow } from "src/types";
import UserStateService from "src/userState/UserStateService";
import { decodeInstitutionId } from "src/utils/institutionUtils";

export interface UseInstructorStudentsResult {
  students: InstructorStudentRow[];
  loading: boolean;
  error: Error | null;
  hasMoreRows: boolean;
  loadMoreRows: () => Promise<void>;
}

const FETCH_BATCH_SIZE = 100;

const toText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeGender = (value: string | null): string | null => {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "m" || v === "male") return "Male";
  if (v === "f" || v === "female") return "Female";
  return value;
};

const formatLastLogin = (value: string | null): string => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / dayMs);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
};

const toInstructorStudentRow = (
  item: Awaited<ReturnType<AnalyticsService["listStudents"]>>["data"][number]
): InstructorStudentRow | null => {
  const id = toText(item.id);
  const name = toText(item.name);
  if (!id || !name) {
    return null;
  }

  const programme = toText(item.programme) ?? PLACEHOLDER_SYMBOL;
  const qualificationType = toText(item.qualification_type) ?? PLACEHOLDER_SYMBOL;
  const year = toText(item.year) ?? PLACEHOLDER_SYMBOL;
  const gender = normalizeGender(toText(item.gender)) ?? PLACEHOLDER_SYMBOL;
  const lastActiveModuleId = toText(item.last_active_module) ?? PLACEHOLDER_SYMBOL;

  const modulesExplored = item.modules_explored ?? 0;
  const careerReady = item.career_readiness_modules_explored ?? 0;
  return {
    id,
    studentName: name,
    programme,
    qualificationType,
    year,
    gender,
    modulesExplored,
    careerReady: `${careerReady}/6`,
    skillsDiscoveryStatus: item.skills_discovery_status ?? "not_started",
    careerExplorerMessagesSent: item.career_explorer_messages_sent ?? null,
    lastLogin: formatLastLogin(item.last_login),
    lastActiveModuleId,
  };
};

export function useInstructorStudents(): UseInstructorStudentsResult {
  const [students, setStudents] = useState<InstructorStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const isFetchingRef = useRef(false);
  isFetchingRef.current = isFetching;

  const fetchAllRows = useCallback(async () => {
    if (isFetchingRef.current) return;
    setIsFetching(true);
    setLoading(true);

    try {
      const institutionId = UserStateService.getInstance().getInstitutionId();
      const institution = institutionId ? decodeInstitutionId(institutionId) : undefined;

      const allRows: InstructorStudentRow[] = [];
      let cursor: string | undefined = undefined;

      while (true) {
        const result = await AnalyticsService.getInstance().listStudents({
          limit: FETCH_BATCH_SIZE,
          cursor,
          institution,
        });

        const mappedStudents = result.data
          .map(toInstructorStudentRow)
          .filter((student): student is InstructorStudentRow => student !== null);

        allRows.push(...mappedStudents);

        if (!result.meta.next_cursor) break;
        cursor = result.meta.next_cursor;
      }

      setStudents(allRows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStudents([]);
    } finally {
      setIsFetching(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAllRows();
  }, [fetchAllRows]);

  return {
    students,
    loading,
    error,
    hasMoreRows: false,
    loadMoreRows: async () => {},
  };
}
