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
import SearchIcon from "@mui/icons-material/Search";
import { useSortableData } from "src/jobMatching/hooks/useSortableData";

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
  align?: "left" | "right" | "center";
  minWidth?: number;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  /** Extra sx applied to every body cell in this column */
  cellSx?: object;
  /** When provided, a filter icon appears in the header */
  filter?: ColumnFilterConfig;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DataTableProps<T extends { id: string }> {
  rows: T[];
  columns: ColumnDef<T>[];
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
  /** Called when a row is clicked */
  onRowClick?: (row: T) => void;
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

const SEARCHABLE_FILTER_THRESHOLD = 5;

function FilterIconButton<T>({
  col,
  isActiveSortKey,
  activeSortDir,
  onSort,
  showSortClear,
  onSortClear,
  sortClearLabel,
}: FilterIconButtonProps<T>) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const open = Boolean(anchorEl);
  const theme = useTheme();

  const hasFilter = !!col.filter;
  const isFiltered = hasFilter && col.filter!.value !== "all" && col.filter!.value !== "";
  const isActive = isFiltered || isActiveSortKey;

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
          opacity: 1,
          "&:hover": { color: "text.primary" },
          flexShrink: 0,
        }}
        aria-label={`filter ${String(col.key)}`}
      >
        <FilterAltIcon sx={{ fontSize: "0.82rem" }} />
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null);
          setFilterSearch("");
        }}
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
          {/* Search — shown at the top when filter has >5 options */}
          {hasFilter && col.filter!.options.length > SEARCHABLE_FILTER_THRESHOLD && (
            <>
              <Box
                px={1}
                pt={theme.fixedSpacing(theme.tabiyaSpacing.xxs)}
                pb={theme.fixedSpacing(theme.tabiyaSpacing.xxs)}
              >
                <TextField
                  size="small"
                  placeholder="Search…"
                  value={filterSearch}
                  autoFocus
                  onChange={(e) => setFilterSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  slotProps={{
                    input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: "text.disabled" }} /> },
                    htmlInput: { "aria-label": "search filter options" },
                  }}
                  sx={{ width: "100%" }}
                />
              </Box>
              <Divider sx={{ mb: theme.fixedSpacing(theme.tabiyaSpacing.xxs) }} />
            </>
          )}

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
                Sort ascending
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
                Sort descending
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

          {/* Filter list */}
          {hasFilter &&
            (() => {
              const isSearchable = col.filter!.options.length > SEARCHABLE_FILTER_THRESHOLD;
              const visibleOptions = isSearchable
                ? col.filter!.options.filter((opt) => opt.label.toLowerCase().includes(filterSearch.toLowerCase()))
                : col.filter!.options;
              return (
                <MenuList
                  key={open ? "open" : "closed"}
                  dense
                  disablePadding
                  sx={{ maxHeight: 200, overflowY: "auto" }}
                >
                  {visibleOptions.map((opt) => (
                    <MenuItem
                      key={opt.value}
                      dense
                      selected={col.filter!.value === opt.value}
                      onClick={() => {
                        col.filter!.onChange(opt.value);
                        setAnchorEl(null);
                        setFilterSearch("");
                      }}
                      sx={{ fontSize: "0.78rem", color: "text.primary" }}
                    >
                      {opt.label}
                    </MenuItem>
                  ))}
                </MenuList>
              );
            })()}
        </Box>
      </Popover>
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function DataTable<T extends { id: string }>({
  rows,
  columns,
  loading = false,
  skeletonRows = 8,
  emptyMessage = "No data",
  search,
  page,
  totalPages,
  onPageChange,
  prevPageLabel = "Previous page",
  nextPageLabel = "Next page",
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
  onRowClick,
}: DataTableProps<T>): React.ReactElement {
  const theme = useTheme();

  // ── Sorting ───────────────────────────────────────────────────────────────
  const controlled = externalSortKey !== undefined;
  const {
    sorted: internalSorted,
    sortKey: internalSortKey,
    sortDir: internalSortDir,
    handleSort: internalHandleSort,
  } = useSortableData<T>(rows, initialSortKey, initialSortDir);

  const activeSortKey = controlled ? externalSortKey : internalSortKey;
  const activeSortDir = controlled ? externalSortDir ?? "asc" : internalSortDir;
  const showSortClear = Boolean(onSortClear && controlled && activeSortKey !== null && activeSortKey !== undefined);

  const handleSortClick = (key: keyof T, dir?: "asc" | "desc") => {
    if (controlled) onSortChange?.(key, dir);
    else internalHandleSort(key, dir);
  };

  const displayRows = controlled ? rows : internalSorted;

  // ── Tokens ────────────────────────────────────────────────────────────────
  const headBg = theme.palette.containerBackground.main;
  const borderColor = theme.palette.divider;
  const colDividerColor = theme.palette.grey[200];

  const totalCols = columns.length;

  const headerPx = theme.fixedSpacing(1.5);
  const headerPy = theme.fixedSpacing(1.25);

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
        {isActive &&
          (activeSortDir === "asc" ? (
            <ArrowUpwardIcon sx={{ fontSize: "0.72rem", color: "primary.main", flexShrink: 0 }} />
          ) : (
            <ArrowDownwardIcon sx={{ fontSize: "0.72rem", color: "primary.main", flexShrink: 0 }} />
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {search && (
        <Box mb={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
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
            <TableRow>
              {columns.map((col, i) => (
                <TableCell
                  key={String(col.key)}
                  align={col.align ?? "left"}
                  sx={{
                    verticalAlign: "bottom",
                    minWidth: col.minWidth,
                    borderRight: i < columns.length - 1 ? `1px solid ${colDividerColor}` : undefined,
                    py: headerPy,
                    px: headerPx,
                  }}
                >
                  {renderMainLabel(col)}
                </TableCell>
              ))}
            </TableRow>
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
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((row, idx) => (
                <TableRow
                  key={row.id}
                  hover
                  onClick={() => onRowClick?.(row)}
                  sx={{
                    backgroundColor: idx % 2 === 0 ? "transparent" : alpha(theme.palette.action.hover, 0.03),
                    "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.05) },
                    "&:last-child td": { borderBottom: 0 },
                    cursor: onRowClick ? "pointer" : "default",
                  }}
                >
                  {columns.map((col) => {
                    const value = row[col.key];
                    const content = col.render ? col.render(value, row) : (value as React.ReactNode);
                    return (
                      <TableCell
                        key={String(col.key)}
                        align={col.align ?? "left"}
                        sx={{
                          py: headerPy,
                          px: headerPx,
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
                if (type === "previous") return prevPageLabel;
                if (type === "next") return nextPageLabel;
                if (type === "page") return `Page ${p}`;
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
