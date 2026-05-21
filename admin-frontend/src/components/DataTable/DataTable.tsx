import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
  Box,
  Skeleton,
  alpha,
  IconButton,
  TextField,
  MenuItem,
  MenuList,
  Paper,
  Popover,
  Divider,
  Pagination,
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import { useTranslation } from "react-i18next";
import { useSortableData } from "src/hooks/useSortableData";

// ─── Column & Group definitions ──────────────────────────────────────────────

export interface ColumnFilterConfig {
  options: { value: string; label: string }[];
  /** Controlled current value ("all" = no active filter) */
  value: string;
  onChange: (value: string) => void;
}

export interface SearchConfig {
  placeholder: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
}

export interface ColumnDef<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  sortType?: "text" | "number";
  align?: "left" | "right" | "center";
  minWidth?: number;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  /** Optional group key this column belongs to (for 2-row headers) */
  group?: string;
  /** Extra sx applied to every body cell in this column */
  cellSx?: object;
  /** When provided, a filter icon appears in the header */
  filter?: ColumnFilterConfig;
}

export interface ColumnGroup {
  key: string;
  label: string;
  colSpan: number;
  color?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DataTableProps<T extends { id: string }> {
  rows: T[];
  columns: ColumnDef<T>[];
  columnGroups?: ColumnGroup[];
  loading?: boolean;
  skeletonRows?: number;
  emptyMessage?: string;
  /** When provided, renders a search field above the table */
  search?: SearchConfig;
  // Pagination
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  prevPageLabel?: string;
  nextPageLabel?: string;
  pageLabel?: string;
  // Sort (controlled mode)
  externalSortKey?: keyof T | null;
  externalSortDir?: "asc" | "desc";
  onSortChange?: (key: keyof T, dir?: "asc" | "desc") => void;
  onSortClear?: () => void;
  sortClearLabel?: string;
  // Initial sort (uncontrolled mode)
  initialSortKey?: keyof T;
  initialSortDir?: "asc" | "desc";
  ariaLabel?: string;
  tableMinWidth?: number;
}

// ─── FilterIconButton ─────────────────────────────────────────────────────────

interface FilterIconButtonProps<T> {
  col: ColumnDef<T>;
  isActiveSortKey: boolean;
  activeSortDir: "asc" | "desc";
  onSort: (key: keyof T, dir?: "asc" | "desc") => void;
  showSortClear?: boolean;
  onSortClear?: () => void;
  sortClearLabel?: string;
}

function FilterIconButton<T>({
  col,
  isActiveSortKey,
  activeSortDir,
  onSort,
  showSortClear,
  onSortClear,
  sortClearLabel,
}: FilterIconButtonProps<T>) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);
  const theme = useTheme();

  const hasFilter = !!col.filter;
  const isFiltered = hasFilter && col.filter!.value !== "all" && col.filter!.value !== "";
  const isActive = isFiltered || isActiveSortKey;

  const ascendingLabel =
    col.sortType === "number" ? t("common.dataTable.sortAscending") : t("common.dataTable.sortAscText");
  const descendingLabel =
    col.sortType === "number" ? t("common.dataTable.sortDescending") : t("common.dataTable.sortDescText");

  return (
    <>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          setAnchorEl(e.currentTarget);
        }}
        sx={{
          p: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
          ml: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
          color: isActive ? "primary.main" : "text.disabled",
          opacity: isActive ? 1 : 0.45,
          "&:hover": { opacity: 1, color: "text.primary" },
          flexShrink: 0,
        }}
        aria-label={t("common.dataTable.filterAriaLabel", { column: String(col.key) })}
      >
        <FilterAltIcon sx={{ fontSize: "0.82rem" }} />
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              mt: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
              minWidth: 160,
              maxWidth: 240,
              boxShadow: theme.shadows[4],
              borderRadius: theme.rounding(theme.tabiyaRounding.xs),
            },
          },
        }}
      >
        <Box
          sx={{
            backgroundColor: theme.palette.containerBackground.light,
            py: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
          }}
        >
          {/* Sort rows */}
          {col.sortable !== false && (
            <>
              <MenuItem
                dense
                selected={isActiveSortKey && activeSortDir === "asc"}
                onClick={() => {
                  onSort(col.key, "asc");
                  setAnchorEl(null);
                }}
                sx={{ gap: theme.fixedSpacing(theme.tabiyaSpacing.sm), fontSize: "0.78rem", color: "text.primary" }}
              >
                <ArrowUpwardIcon sx={{ fontSize: "0.85rem", flexShrink: 0 }} />
                {ascendingLabel}
              </MenuItem>
              <MenuItem
                dense
                selected={isActiveSortKey && activeSortDir === "desc"}
                onClick={() => {
                  onSort(col.key, "desc");
                  setAnchorEl(null);
                }}
                sx={{ gap: theme.fixedSpacing(theme.tabiyaSpacing.sm), fontSize: "0.78rem", color: "text.primary" }}
              >
                <ArrowDownwardIcon sx={{ fontSize: "0.85rem", flexShrink: 0 }} />
                {descendingLabel}
              </MenuItem>
              {showSortClear && onSortClear && sortClearLabel && (
                <>
                  <Divider sx={{ my: theme.fixedSpacing(theme.tabiyaSpacing.xxs) }} />
                  <MenuItem
                    dense
                    onClick={() => {
                      onSortClear();
                      setAnchorEl(null);
                    }}
                    sx={{ fontSize: "0.78rem", color: "text.primary" }}
                  >
                    {sortClearLabel}
                  </MenuItem>
                </>
              )}
              {hasFilter && <Divider sx={{ my: theme.fixedSpacing(theme.tabiyaSpacing.xxs) }} />}
            </>
          )}

          {/* Filter */}
          {hasFilter && (
            <MenuList dense disablePadding sx={{ maxHeight: 240, overflowY: "auto" }}>
              {col.filter!.options.map((opt) => (
                <MenuItem
                  key={opt.value}
                  dense
                  selected={col.filter!.value === opt.value}
                  onClick={() => {
                    col.filter!.onChange(opt.value);
                    setAnchorEl(null);
                  }}
                  sx={{ fontSize: "0.78rem", color: "text.primary" }}
                >
                  {opt.label}
                </MenuItem>
              ))}
            </MenuList>
          )}
        </Box>
      </Popover>
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function DataTable<T extends { id: string }>({
  rows,
  columns,
  columnGroups,
  loading = false,
  skeletonRows = 8,
  emptyMessage,
  search,
  page,
  totalPages,
  onPageChange,
  prevPageLabel,
  nextPageLabel,
  pageLabel,
  externalSortKey,
  externalSortDir,
  onSortChange,
  onSortClear,
  sortClearLabel,
  initialSortKey,
  initialSortDir = "asc",
  ariaLabel,
  tableMinWidth,
}: DataTableProps<T>): React.ReactElement {
  const theme = useTheme();
  const { t } = useTranslation();
  const resolvedEmptyMessage = emptyMessage ?? t("common.dataTable.noData");
  const resolvedPrevPageLabel = prevPageLabel ?? t("common.dataTable.prevPage");
  const resolvedNextPageLabel = nextPageLabel ?? t("common.dataTable.nextPage");

  // ── Sorting ───────────────────────────────────────────────────────────────
  const controlled = externalSortKey !== undefined;
  const {
    sorted: internalSorted,
    sortKey: internalSortKey,
    sortDir: internalSortDir,
    handleSort: internalHandleSort,
  } = useSortableData<T>(rows, initialSortKey, initialSortDir);

  const activeSortKey = controlled ? externalSortKey : internalSortKey;
  const activeSortDir = controlled ? (externalSortDir ?? "asc") : internalSortDir;
  const showSortClear = Boolean(onSortClear && controlled && activeSortKey !== null && activeSortKey !== undefined);

  const handleSortClick = (key: keyof T, dir?: "asc" | "desc") => {
    if (controlled) onSortChange?.(key, dir);
    else internalHandleSort(key, dir);
  };

  const displayRows = controlled ? rows : internalSorted;

  // ── Tokens ────────────────────────────────────────────────────────────────
  // Use containerBackground.main for header — matches the MuiTableHead default override
  const headBg = theme.palette.containerBackground.main;
  // Full-strength divider for outer borders; grey[200] for faint internal column dividers
  const borderColor = theme.palette.divider;
  const colDividerColor = theme.palette.grey[200];

  const hasGroupedHeader = !!columnGroups && columnGroups.length > 0;
  const totalCols = columns.length;

  // Map column key → its ColumnGroup (for sub-header tint)
  const colToGroup = new Map<string, ColumnGroup>();
  if (columnGroups) {
    columnGroups.forEach((g) => {
      columns.filter((c) => c.group === g.key).forEach((c) => colToGroup.set(String(c.key), g));
    });
  }

  // Shared cell padding (slightly roomier than raw sm/xs so tables feel less cramped)
  const headerPx = theme.fixedSpacing(1.5); // 12px
  const headerPxGroup = theme.fixedSpacing(1); // 8px (grouped metric columns)
  const headerPy = theme.fixedSpacing(1.25); // 10px
  const headerPyGroup = theme.fixedSpacing(0.75); // 6px

  const headerJustifyContent = (align: ColumnDef<T>["align"]) =>
    align === "right" ? "flex-end" : align === "left" ? "flex-start" : "center";

  // ── Header cell content ───────────────────────────────────────────────────

  const renderMainLabel = (col: ColumnDef<T>) => {
    const isActive = activeSortKey === col.key;
    const isSortable = col.sortable !== false;

    if (!isSortable && !col.filter) {
      return (
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            fontSize: "0.68rem",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            whiteSpace: "normal",
            lineHeight: 1.2,
          }}
        >
          {col.label}
        </Typography>
      );
    }

    // Filter (± sort): plain label + inline sort indicator + filter icon
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
          justifyContent: headerJustifyContent(col.align),
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            fontSize: "0.68rem",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            whiteSpace: "normal",
            lineHeight: 1.2,
          }}
        >
          {col.label}
        </Typography>
        {isSortable &&
          isActive &&
          (activeSortDir === "asc" ? (
            <ArrowUpwardIcon sx={{ fontSize: "0.82rem", color: "primary.main", flexShrink: 0 }} />
          ) : (
            <ArrowDownwardIcon sx={{ fontSize: "0.82rem", color: "primary.main", flexShrink: 0 }} />
          ))}
        {(isSortable || col.filter) && (
          <FilterIconButton<T>
            col={col}
            isActiveSortKey={isActive}
            activeSortDir={activeSortDir}
            onSort={handleSortClick}
            showSortClear={showSortClear}
            onSortClear={onSortClear}
            sortClearLabel={sortClearLabel}
          />
        )}
      </Box>
    );
  };

  const renderGroupLabel = (col: ColumnDef<T>) => {
    const isActive = activeSortKey === col.key;
    const [line1, line2] = col.label.split("\n");
    const isSortable = col.sortable !== false;
    const canFilter = Boolean(col.filter);

    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: theme.fixedSpacing(theme.tabiyaSpacing.xxs) }}>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                fontSize: "0.65rem",
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                lineHeight: 1.3,
              }}
            >
              {line1}
            </Typography>
            {line2 && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: "0.58rem",
                  color: "text.disabled",
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  lineHeight: 1.3,
                }}
              >
                {line2}
              </Typography>
            )}
          </Box>
          {isSortable &&
            isActive &&
            (activeSortDir === "asc" ? (
              <ArrowUpwardIcon sx={{ fontSize: "0.78rem", color: "primary.main", flexShrink: 0 }} />
            ) : (
              <ArrowDownwardIcon sx={{ fontSize: "0.78rem", color: "primary.main", flexShrink: 0 }} />
            ))}
          {(isSortable || canFilter) && (
            <FilterIconButton<T>
              col={col}
              isActiveSortKey={isActive}
              activeSortDir={activeSortDir}
              onSort={handleSortClick}
              showSortClear={showSortClear}
              onSortClear={onSortClear}
              sortClearLabel={sortClearLabel}
            />
          )}
        </Box>
        {isActive && (
          <Box
            sx={{
              width: 16,
              height: 2,
              borderRadius: theme.rounding(theme.tabiyaRounding.full),
              bgcolor: "primary.main",
              mt: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
            }}
          />
        )}
      </Box>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {search && (
        <Box mb={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
          <TextField
            size="small"
            placeholder={search.placeholder}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            slotProps={{ htmlInput: { "aria-label": search.ariaLabel } }}
            sx={{ width: 280 }}
          />
        </Box>
      )}
      <TableContainer
        component={Paper}
        sx={{
          borderRadius: theme.rounding(theme.tabiyaRounding.sm),
          overflowX: "auto",
          border: `1px solid ${borderColor}`,
          boxShadow: theme.shadows[1],
        }}
      >
        <Table
          size="small"
          aria-label={ariaLabel}
          sx={{
            minWidth: tableMinWidth,
            "& .MuiTableCell-root": { color: theme.palette.text.secondary },
            "& .MuiTypography-root": { color: "inherit" },
          }}
        >
          <TableHead
            sx={{
              "& .MuiTableCell-root": {
                backgroundColor: headBg,
                fontWeight: 700,
                fontSize: "0.68rem",
                borderBottom: `1px solid ${borderColor}`,
                whiteSpace: "nowrap",
              },
            }}
          >
            {hasGroupedHeader ? (
              <>
                <TableRow>
                  {columns
                    .filter((c) => !c.group)
                    .map((col) => (
                      <TableCell
                        key={String(col.key)}
                        rowSpan={2}
                        align={col.align ?? "center"}
                        sx={{
                          py: headerPy,
                          px: headerPx,
                          verticalAlign: "bottom",
                          minWidth: col.minWidth,
                          borderRight: `1px solid ${colDividerColor}`,
                        }}
                      >
                        {renderMainLabel(col)}
                      </TableCell>
                    ))}

                  {columnGroups!.map((g) => (
                    <TableCell
                      key={g.key}
                      colSpan={g.colSpan}
                      sx={{
                        borderBottom: g.color ? `2px solid ${g.color}` : `1px solid ${borderColor}`,
                        borderRight: `1px solid ${colDividerColor}`,
                        textAlign: "center",
                        py: headerPyGroup,
                        px: headerPxGroup,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          fontSize: "0.65rem",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          color: g.color,
                        }}
                      >
                        {g.label}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>

                <TableRow>
                  {columns
                    .filter((c) => !!c.group)
                    .map((col, i, arr) => {
                      const grp = colToGroup.get(String(col.key));
                      const isLastInGroup = i === arr.length - 1 || arr[i + 1].group !== col.group;
                      return (
                        <TableCell
                          key={String(col.key)}
                          align="center"
                          sx={{
                            py: headerPyGroup,
                            px: headerPxGroup,
                            minWidth: col.minWidth ?? 80,
                            borderRight: isLastInGroup ? `1px solid ${colDividerColor}` : undefined,
                            backgroundColor: grp?.color ? alpha(grp.color, 0.06) : undefined,
                          }}
                        >
                          {renderGroupLabel(col)}
                        </TableCell>
                      );
                    })}
                </TableRow>
              </>
            ) : (
              <TableRow>
                {columns.map((col, i) => (
                  <TableCell
                    key={String(col.key)}
                    align={col.align ?? "center"}
                    sx={{
                      verticalAlign: "bottom",
                      minWidth: col.minWidth,
                      borderRight: i < columns.length - 1 ? `1px solid ${colDividerColor}` : undefined,
                    }}
                  >
                    {renderMainLabel(col)}
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableHead>

          <TableBody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: totalCols }).map((__, j) => (
                    <TableCell key={j} sx={{ py: headerPy, px: headerPx }}>
                      <Skeleton variant="text" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : displayRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={totalCols}
                  align="center"
                  sx={{ py: theme.fixedSpacing(theme.tabiyaSpacing.xl), borderBottom: 0 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {resolvedEmptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((row, idx) => (
                <TableRow
                  key={`${String(row.id)}-${idx}`}
                  hover
                  sx={{
                    backgroundColor: idx % 2 === 0 ? "transparent" : alpha(theme.palette.action.hover, 0.03),
                    "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.05) },
                    "&:last-child td": { borderBottom: 0 },
                  }}
                >
                  {columns.map((col) => {
                    const value = row[col.key];
                    const content = col.render ? col.render(value, row) : (value as React.ReactNode);
                    return (
                      <TableCell
                        key={String(col.key)}
                        align={col.align ?? "center"}
                        sx={{
                          py: headerPy,
                          px: col.group ? headerPxGroup : headerPx,
                          minWidth: col.minWidth,
                          ...col.cellSx,
                        }}
                      >
                        {content}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {page !== undefined && totalPages !== undefined && onPageChange && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: { xs: "center", sm: "space-between" },
            gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
            mt: theme.fixedSpacing(theme.tabiyaSpacing.md),
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: { xs: "none", sm: "block" },
              textAlign: "left",
              minWidth: 0,
              flexShrink: 1,
            }}
          >
            {pageLabel ?? ""}
          </Typography>
          <Box
            sx={{
              maxWidth: "100%",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              flexShrink: 0,
              pb: 0.25,
            }}
          >
            <Pagination
              page={page}
              count={Math.max(1, totalPages)}
              onChange={(_event, nextPage) => onPageChange(nextPage)}
              color="primary"
              size="small"
              shape="rounded"
              siblingCount={0}
              boundaryCount={1}
              disabled={loading}
              showFirstButton={false}
              showLastButton={false}
              getItemAriaLabel={(type, p) => {
                if (type === "previous") return resolvedPrevPageLabel;
                if (type === "next") return resolvedNextPageLabel;
                if (type === "page") return t("common.dataTable.pageAriaLabel", { page: p });
                return type;
              }}
              sx={{
                "& .MuiPagination-ul": {
                  flexWrap: "nowrap",
                  gap: theme.fixedSpacing(theme.tabiyaSpacing.xs),
                },
                "& .MuiPaginationItem-root": {
                  minWidth: { xs: 30, sm: 34 },
                  height: { xs: 30, sm: 34 },
                  fontSize: { xs: "0.875rem", sm: "1rem" },
                  borderRadius: theme.rounding(theme.tabiyaRounding.xs),
                  margin: 0,
                },
                "& .MuiPaginationItem-ellipsis": {
                  minWidth: { xs: 20, sm: 24 },
                },
              }}
            />
          </Box>
        </Box>
      )}
    </>
  );
}

export default DataTable;
