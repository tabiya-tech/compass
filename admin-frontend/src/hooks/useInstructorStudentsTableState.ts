import { useEffect, useMemo, useState } from "react";
import { MODULE_ID_TO_I18N_KEY, PLACEHOLDER_SYMBOL } from "src/constants";
import { MODULE_FILTER_PROGRAMMES } from "src/data/moduleFilterOptions";
import { lastLoginDisplayMatchesFilter } from "src/hooks/instructorStudentsLastLoginFilter";
import type { InstructorStudentRow } from "src/types";

export type StudentsSortKey =
  | "studentName"
  | "programme"
  | "year"
  | "lastLogin"
  | "lastActiveModuleId"
  | "modulesExplored"
  | "careerReady"
  | "skillsInterestsExplored";
type SortDir = "asc" | "desc";

type UseInstructorStudentsTableStateOptions = {
  pageSize?: number;
  hasMoreRows?: boolean;
  loadingRows?: boolean;
  onLoadMoreRows?: () => Promise<void>;
};

const DEFAULT_PAGE_SIZE = 20;

const isMissingText = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === PLACEHOLDER_SYMBOL;
};

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

const fracRatio = (value: string): number => {
  const matched = value.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!matched) return Number.NaN;
  const numerator = Number(matched[1]);
  const denominator = Number(matched[2]);
  return denominator > 0 ? numerator / denominator : Number.NaN;
};

const normalizeText = (value: string): string | null => (isMissingText(value) ? null : value.trim().toLowerCase());

const normalizeYear = (value: string): number | null => {
  if (isMissingText(value)) return null;
  const numericYear = Number.parseInt(value, 10);
  return Number.isNaN(numericYear) ? null : numericYear;
};

const normalizeLastLogin = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === "Today") return 0;
  if (trimmed === "Yesterday") return 1;
  if (trimmed === "Never" || isMissingText(trimmed)) return null;
  const dayMatch = trimmed.match(/^(\d+)\s*days?\s*ago$/i);
  if (!dayMatch) return null;
  return Number(dayMatch[1]);
};

export function useInstructorStudentsTableState(
  rows: InstructorStudentRow[],
  options?: number | UseInstructorStudentsTableStateOptions
) {
  const resolvedOptions: UseInstructorStudentsTableStateOptions =
    typeof options === "number" ? { pageSize: options } : (options ?? {});

  const pageSize = resolvedOptions.pageSize ?? DEFAULT_PAGE_SIZE;
  const hasMoreRows = resolvedOptions.hasMoreRows ?? false;
  const loadingRows = resolvedOptions.loadingRows ?? false;
  const onLoadMoreRows = resolvedOptions.onLoadMoreRows;
  const [sortKey, setSortKey] = useState<StudentsSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [nameSearch, setNameSearch] = useState("");
  const [programme, setProgramme] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [lastLoginFilter, setLastLoginFilter] = useState("all");
  const [lastModuleFilter, setLastModuleFilter] = useState("all");
  const [pageIndex, setPageIndex] = useState(0);

  const debouncedNameSearch = useDebouncedValue(nameSearch, 250);

  const programmes = useMemo(() => ["all", ...MODULE_FILTER_PROGRAMMES], []);
  const years = useMemo(() => ["all", ...Array.from(new Set(rows.map((r) => r.year)))], [rows]);
  const modules = useMemo(() => {
    const knownModuleIds = Object.keys(MODULE_ID_TO_I18N_KEY);
    const dynamic = Array.from(
      new Set(rows.map((r) => r.lastActiveModuleId).filter((moduleId) => moduleId !== PLACEHOLDER_SYMBOL))
    );
    return ["all", ...Array.from(new Set([...knownModuleIds, ...dynamic]))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = debouncedNameSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (query && !row.studentName.toLowerCase().includes(query)) return false;
      if (programme !== "all" && row.programme !== programme) return false;
      if (yearFilter !== "all" && row.year !== yearFilter) return false;
      if (lastModuleFilter !== "all" && row.lastActiveModuleId !== lastModuleFilter) return false;

      if (lastLoginFilter === "all") return true;
      return lastLoginDisplayMatchesFilter(row.lastLogin, lastLoginFilter);
    });
  }, [debouncedNameSearch, lastLoginFilter, lastModuleFilter, programme, rows, yearFilter]);

  const sortedRows = useMemo(() => {
    if (!sortKey) {
      return filteredRows;
    }

    const getValue = (row: InstructorStudentRow, key: StudentsSortKey): number | string | null => {
      if (key === "studentName") return normalizeText(row.studentName);
      if (key === "programme") return normalizeText(row.programme);
      if (key === "year") return normalizeYear(row.year);
      if (key === "lastLogin") return normalizeLastLogin(row.lastLogin);
      if (key === "lastActiveModuleId") return normalizeText(row.lastActiveModuleId);
      if (key === "modulesExplored") return row.modulesExplored;
      if (key === "careerReady") {
        const ratio = fracRatio(row.careerReady);
        return Number.isNaN(ratio) ? null : ratio;
      }
      return row.skillsInterestsExplored;
    };

    return [...filteredRows].sort((a, b) => {
      const left = getValue(a, sortKey);
      const right = getValue(b, sortKey);
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      const comparison =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right)
          : left < right
            ? -1
            : left > right
              ? 1
              : 0;
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [filteredRows, sortDir, sortKey]);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedNameSearch, programme, yearFilter, lastLoginFilter, lastModuleFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pageStart = safePageIndex * pageSize;
  const pagedRows = sortedRows.slice(pageStart, pageStart + pageSize);
  useEffect(() => {
    const isBeyondLoadedRows = pageStart >= sortedRows.length;
    if (isBeyondLoadedRows && hasMoreRows && !loadingRows && onLoadMoreRows) {
      void onLoadMoreRows();
    }
  }, [hasMoreRows, loadingRows, onLoadMoreRows, pageStart, sortedRows.length]);

  const handleSort = (key: StudentsSortKey, dir?: SortDir) => {
    if (sortKey === key) {
      setSortDir((prev) => dir ?? (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(dir ?? "asc");
  };

  const clearSort = () => {
    setSortKey(null);
    setSortDir("asc");
  };

  const goToPage = (pageNumber: number) => {
    if (!Number.isInteger(pageNumber)) return;
    const nextIndex = Math.max(0, Math.min(totalPages - 1, pageNumber - 1));
    setPageIndex(nextIndex);
  };

  return {
    sortKey,
    sortDir,
    handleSort,
    clearSort,
    nameSearch,
    setNameSearch,
    programme,
    setProgramme,
    yearFilter,
    setYearFilter,
    lastLoginFilter,
    setLastLoginFilter,
    lastModuleFilter,
    setLastModuleFilter,
    programmes,
    years,
    modules,
    filteredRows,
    pagedRows,
    pageSize,
    totalItems: sortedRows.length,
    totalPages,
    safePageIndex,
    goToPage,
  };
}
