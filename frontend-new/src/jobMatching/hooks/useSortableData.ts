import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export function useSortableData<T>(data: T[], initialKey?: keyof T, initialDir: SortDir = "asc") {
  const [sortKey, setSortKey] = useState<keyof T | undefined>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);

  const handleSort = (key: keyof T, requestedDir?: SortDir) => {
    setSortKey((prev) => {
      if (requestedDir) {
        setSortDir(requestedDir);
        return key;
      }
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortDir("asc");
      }
      return key;
    });
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (typeof av === "string" && typeof bv === "string") {
        cmp = av.localeCompare(bv);
      } else {
        cmp = (av as number) < (bv as number) ? -1 : (av as number) > (bv as number) ? 1 : 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, handleSort };
}
