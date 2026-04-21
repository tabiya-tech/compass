import React from "react";
import { Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { InstitutionRow } from "src/types";
import DataTable, { type ColumnDef, type ColumnGroup } from "src/components/DataTable/DataTable";

export interface InstitutionsTableProps {
  rows: InstitutionRow[];
  loading?: boolean;
  page?: number;
  sortKey?: keyof InstitutionRow | null;
  sortDir?: "asc" | "desc";
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  onSortChange?: (key: keyof InstitutionRow, dir?: "asc" | "desc") => void;
  onSortClear?: () => void;
}

const GROUP_COLORS = {
  skillsDiscovery: "#4C9BE8",
  careerReadiness: "#7B61C4",
  careerExplorer: "#2ECC71",
};

const InstitutionsTable: React.FC<InstitutionsTableProps> = ({
  rows,
  loading = false,
  page,
  sortKey,
  sortDir,
  hasNextPage,
  hasPrevPage,
  onNextPage,
  onPrevPage,
  onSortChange,
  onSortClear,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const renderPct = (val: InstitutionRow[keyof InstitutionRow]) => {
    const n = val as number | null | undefined;
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", width: "100%" }}>
        {n === null || n === undefined ? "—" : `${n}%`}
      </Typography>
    );
  };

  const renderNum = (val: InstitutionRow[keyof InstitutionRow]) => {
    const n = val as number | null | undefined;
    return (
      <Typography variant="body2" sx={{ textAlign: "center", width: "100%" }}>
        {n === null || n === undefined ? "—" : n.toLocaleString()}
      </Typography>
    );
  };

  const renderInstitution = (val: InstitutionRow[keyof InstitutionRow]) => (
    <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary, textAlign: "center" }}>
      {val as string}
    </Typography>
  );

  // Percentage columns depend on whether students data is available
  const renderGroupedPct =
    (key: keyof InstitutionRow) => (val: InstitutionRow[keyof InstitutionRow], row: InstitutionRow) => {
      const studentsAvailable = row.students !== null && row.students !== undefined;
      return renderPct(studentsAvailable ? row[key] : null);
    };

  const colDividerColor = theme.palette.grey[200];

  const columns: ColumnDef<InstitutionRow>[] = [
    {
      key: "institution",
      label: t("dashboard.institutionsTable.headers.institution"),
      sortable: true,
      sortType: "text",
      align: "center",
      minWidth: 180,
      render: renderInstitution,
      cellSx: { borderRight: `1px solid ${colDividerColor}` },
    },
    {
      key: "students",
      label: t("dashboard.institutionsTable.headers.students"),
      sortable: true,
      sortType: "number",
      align: "center",
      minWidth: 76,
      render: renderNum,
      cellSx: { fontVariantNumeric: "tabular-nums" },
    },
    {
      key: "active7Days",
      label: t("dashboard.institutionsTable.headers.active7Days"),
      sortable: true,
      sortType: "number",
      align: "center",
      minWidth: 90,
      render: renderNum,
      cellSx: { fontVariantNumeric: "tabular-nums", borderRight: `1px solid ${colDividerColor}` },
    },
    {
      key: "skillsDiscoveryStartedPct",
      label: `${t("dashboard.institutionsTable.subHeaders.started")}\n${t("dashboard.institutionsTable.subHeaders.ofReg")}`,
      sortable: true,
      sortType: "number",
      align: "center",
      minWidth: 80,
      group: "skillsDiscovery",
      render: renderGroupedPct("skillsDiscoveryStartedPct"),
    },
    {
      key: "skillsDiscoveryCompletedPct",
      label: `${t("dashboard.institutionsTable.subHeaders.completed")}\n${t("dashboard.institutionsTable.subHeaders.ofStarted")}`,
      sortable: true,
      sortType: "number",
      align: "center",
      minWidth: 80,
      group: "skillsDiscovery",
      render: renderGroupedPct("skillsDiscoveryCompletedPct"),
      cellSx: { borderRight: `1px solid ${colDividerColor}` },
    },
    {
      key: "careerReadinessStartedPct",
      label: `${t("dashboard.institutionsTable.subHeaders.started")}\n${t("dashboard.institutionsTable.subHeaders.ofReg")}`,
      sortable: true,
      sortType: "number",
      align: "center",
      minWidth: 80,
      group: "careerReadiness",
      render: renderGroupedPct("careerReadinessStartedPct"),
    },
    {
      key: "careerReadinessCompletedPct",
      label: `${t("dashboard.institutionsTable.subHeaders.completed")}\n${t("dashboard.institutionsTable.subHeaders.ofStarted")}`,
      sortable: true,
      sortType: "number",
      align: "center",
      minWidth: 80,
      group: "careerReadiness",
      render: renderGroupedPct("careerReadinessCompletedPct"),
      cellSx: { borderRight: `1px solid ${colDividerColor}` },
    },
    {
      key: "careerExplorerStartedPct",
      label: `${t("dashboard.institutionsTable.subHeaders.started")}\n${t("dashboard.institutionsTable.subHeaders.ofReg")}`,
      sortable: true,
      sortType: "number",
      align: "center",
      minWidth: 80,
      group: "careerExplorer",
      render: renderGroupedPct("careerExplorerStartedPct"),
    },
  ];

  const columnGroups: ColumnGroup[] = [
    {
      key: "skillsDiscovery",
      label: t("dashboard.institutionsTable.headers.skillsDiscovery"),
      colSpan: 2,
      color: GROUP_COLORS.skillsDiscovery,
    },
    {
      key: "careerReadiness",
      label: t("dashboard.institutionsTable.headers.careerReadiness"),
      colSpan: 2,
      color: GROUP_COLORS.careerReadiness,
    },
    {
      key: "careerExplorer",
      label: t("dashboard.institutionsTable.headers.careerExplorer"),
      colSpan: 1,
      color: GROUP_COLORS.careerExplorer,
    },
  ];

  return (
    <DataTable<InstitutionRow>
      rows={rows}
      columns={columns}
      columnGroups={columnGroups}
      loading={loading}
      skeletonRows={8}
      emptyMessage={t("dashboard.institutionsTable.empty")}
      externalSortKey={sortKey}
      externalSortDir={sortDir}
      onSortChange={onSortChange}
      onSortClear={onSortClear}
      sortClearLabel={onSortClear ? t("dashboard.dataTable.clearSorting") : undefined}
      ariaLabel="institutions table"
      tableMinWidth={960}
      page={page}
      hasNextPage={hasNextPage}
      hasPrevPage={hasPrevPage}
      onNextPage={onNextPage}
      onPrevPage={onPrevPage}
      prevPageLabel={t("dashboard.institutionsTable.prevPage")}
      nextPageLabel={t("dashboard.institutionsTable.nextPage")}
      pageLabel={page !== undefined ? t("dashboard.institutionsTable.page", { page }) : undefined}
    />
  );
};

export default InstitutionsTable;
