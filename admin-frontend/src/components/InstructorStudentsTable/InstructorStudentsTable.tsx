import React from "react";
import { Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useTranslation } from "react-i18next";
import { getModuleLabelKey, PLACEHOLDER_SYMBOL } from "src/constants";
import { useInstructorStudentsTableState, type StudentsSortKey } from "src/hooks/useInstructorStudentsTableState";
import type { InstructorStudentRow } from "src/types";
import DataTable, { type ColumnDef } from "src/components/DataTable/DataTable";

export interface InstructorStudentsTableProps {
  rows: InstructorStudentRow[];
  loading?: boolean;
  hasMoreRows?: boolean;
  onLoadMoreRows?: () => Promise<void>;
}

const fracComplete = (s: string): boolean => {
  const m = s.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  return !!m && m[1] === m[2] && +m[2] > 0;
};

const checkIconSx = { color: "secondary.main", fontSize: 22 } as const;

const InstructorStudentsTable: React.FC<InstructorStudentsTableProps> = ({
  rows: allRows,
  loading = false,
  hasMoreRows = false,
  onLoadMoreRows,
}) => {
  const { t } = useTranslation();

  const {
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
    totalItems,
    totalPages,
    safePageIndex,
    goToPage,
  } = useInstructorStudentsTableState(allRows, {
    hasMoreRows,
    loadingRows: loading,
    onLoadMoreRows,
  });

  const allLabel = t("instructorDashboard.studentsTable.filters.all");
  const currentPage = safePageIndex + 1;
  const pageLabel = t("dashboard.pagination.range", {
    start: totalItems === 0 ? 0 : safePageIndex * pageSize + 1,
    end: totalItems === 0 ? 0 : Math.min((safePageIndex + 1) * pageSize, totalItems),
    total: totalItems,
  });

  const formatModuleLabel = (moduleId: string) => {
    const key = getModuleLabelKey(moduleId);
    return key ? t(key) : PLACEHOLDER_SYMBOL;
  };

  const columns: ColumnDef<InstructorStudentRow>[] = [
    {
      key: "studentName",
      label: t("instructorDashboard.studentsTable.headers.studentName").toUpperCase(),
      sortable: true,
      sortType: "text",
      align: "center",
      render: (val) => (
        <Typography
          variant="body2"
          noWrap
          title={val as string}
          sx={{ fontWeight: 700, color: "info.main", textAlign: "center", width: "100%" }}
        >
          {val as string}
        </Typography>
      ),
    },
    {
      key: "programme",
      label: t("instructorDashboard.studentsTable.headers.programme").toUpperCase(),
      sortable: true,
      sortType: "text",
      align: "center",
      filter: {
        options: programmes.map((p) => ({ value: p, label: p === "all" ? allLabel : p })),
        value: programme,
        onChange: setProgramme,
      },
      render: (val, row) => (
        <Typography variant="body2" noWrap title={row.programme} sx={{ textAlign: "center", width: "100%" }}>
          {row.programme}
        </Typography>
      ),
    },
    {
      key: "year",
      label: t("instructorDashboard.studentsTable.headers.year").toUpperCase(),
      sortable: true,
      sortType: "number",
      align: "center",
      filter: {
        options: years.map((y) => ({ value: y, label: y === "all" ? allLabel : y })),
        value: yearFilter,
        onChange: setYearFilter,
      },
      render: (val, row) => <span style={{ textAlign: "center", display: "block", width: "100%" }}>{row.year}</span>,
    },
    {
      key: "lastLogin",
      label: t("instructorDashboard.studentsTable.headers.lastLogin").toUpperCase(),
      sortable: true,
      sortType: "number",
      align: "center",
      filter: {
        options: [
          { value: "all", label: allLabel },
          { value: "today", label: t("instructorDashboard.studentsTable.filters.today") },
          { value: "week", label: t("instructorDashboard.studentsTable.filters.thisWeek") },
          { value: "older", label: t("instructorDashboard.studentsTable.filters.older") },
        ],
        value: lastLoginFilter,
        onChange: setLastLoginFilter,
      },
      render: (val) => (
        <Typography variant="body2" noWrap title={val as string} sx={{ textAlign: "center", width: "100%" }}>
          {val as string}
        </Typography>
      ),
    },
    {
      key: "lastActiveModuleId",
      label: t("instructorDashboard.studentsTable.headers.lastActiveModule").toUpperCase(),
      sortable: true,
      sortType: "text",
      align: "center",
      filter: {
        options: modules.map((m) => ({
          value: m,
          label: m === "all" ? allLabel : formatModuleLabel(m),
        })),
        value: lastModuleFilter,
        onChange: setLastModuleFilter,
      },
      render: (val, row) => {
        const label = formatModuleLabel(row.lastActiveModuleId);
        return (
          <Typography variant="body2" noWrap title={label} sx={{ textAlign: "center", width: "100%" }}>
            {label}
          </Typography>
        );
      },
    },
    {
      key: "modulesExplored",
      label: t("instructorDashboard.studentsTable.headers.modulesCompleted"),
      sortable: true,
      sortType: "number",
      align: "center",
      minWidth: 130,
    },
    {
      key: "skillsInterestsExplored",
      label: t("instructorDashboard.studentsTable.headers.skillsInterestsExplored"),
      sortable: true,
      sortType: "number",
      align: "center",
      minWidth: 130,
    },
    {
      key: "careerReady",
      label: t("instructorDashboard.studentsTable.headers.careerReady"),
      sortable: true,
      sortType: "text",
      align: "center",
      minWidth: 130,
      render: (val) => (fracComplete(val as string) ? <CheckCircleIcon sx={checkIconSx} /> : (val as string)),
    },
  ];

  return (
    <DataTable<InstructorStudentRow>
      rows={pagedRows}
      columns={columns}
      loading={loading}
      search={{
        placeholder: t("instructorDashboard.studentsTable.filters.searchPlaceholder"),
        ariaLabel: t("instructorDashboard.studentsTable.filters.searchAriaLabel"),
        value: nameSearch,
        onChange: setNameSearch,
      }}
      skeletonRows={8}
      emptyMessage={filteredRows.length === 0 ? t("instructorDashboard.studentsTable.empty") : undefined}
      ariaLabel={t("instructorDashboard.studentsTable.ariaLabel")}
      externalSortKey={sortKey as keyof InstructorStudentRow | null}
      externalSortDir={sortDir}
      onSortChange={(key, dir) => handleSort(key as StudentsSortKey, dir)}
      onSortClear={clearSort}
      sortClearLabel={t("dashboard.dataTable.clearSorting")}
      page={currentPage}
      totalPages={totalPages}
      onPageChange={goToPage}
      prevPageLabel={t("dashboard.institutionsTable.prevPage")}
      nextPageLabel={t("dashboard.institutionsTable.nextPage")}
      pageLabel={pageLabel}
    />
  );
};

export default InstructorStudentsTable;
