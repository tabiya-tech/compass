import React from "react";
import {
  Box,
  IconButton,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { Role } from "../usersService";
import { useUsersContext } from "../UsersContext";
import UserStateService from "src/userState/UserStateService";
import { decodeInstitutionId } from "src/utils/institutionUtils";

function institutionDisplay(institutionId: string | null | undefined): string {
  if (!institutionId) return "—";
  try {
    return decodeInstitutionId(institutionId);
  } catch {
    return institutionId;
  }
}

const uniqueId = "users-table-6d8e0a2c-4f5b-7c9d-1e3f-5a7b9c0d2e4f";

export const DATA_TEST_ID = {
  USERS_TABLE_CONTAINER: `${uniqueId}-container`,
  USERS_TABLE: `${uniqueId}-table`,
  USERS_TABLE_ROW: `${uniqueId}-table-row`,
  USERS_TABLE_EDIT_BUTTON: `${uniqueId}-edit-button`,
  USERS_TABLE_DELETE_BUTTON: `${uniqueId}-delete-button`,
  USERS_TABLE_EMPTY: `${uniqueId}-empty`,
  USERS_TABLE_SKELETON: `${uniqueId}-skeleton`,
};

const SKELETON_ROW_COUNT = 5;

/**
 * Skeleton placeholder that mirrors the UsersTable layout while data is loading.
 * Renders a fixed number of rows with Skeleton cells matching each column's expected content shape.
 */
export const UsersTableSkeleton: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: theme.tabiyaRounding.sm,
        boxShadow: "none",
        border: theme.tabiyaSpacing.sm,
        borderColor: theme.palette.grey["100"],
      }}
      data-testid={DATA_TEST_ID.USERS_TABLE_SKELETON}
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>{t("users.table.email")}</TableCell>
            <TableCell>{t("users.table.name")}</TableCell>
            <TableCell>{t("users.table.role")}</TableCell>
            <TableCell>{t("users.table.institutionId")}</TableCell>
            <TableCell>{t("users.table.status")}</TableCell>
            <TableCell align="right">{t("users.table.actions")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton />
              </TableCell>
              <TableCell>
                <Skeleton />
              </TableCell>
              <TableCell>
                <Skeleton width="60%" />
              </TableCell>
              <TableCell>
                <Skeleton width="80%" />
              </TableCell>
              <TableCell>
                <Skeleton variant="rounded" width={60} height={24} />
              </TableCell>
              <TableCell align="right">
                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.5 }}>
                  <Skeleton variant="circular" width={28} height={28} />
                  <Skeleton variant="circular" width={28} height={28} />
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const UsersTable: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { users, setUpdateUser, setDeleteUser } = useUsersContext();
  const canManage = UserStateService.getInstance().isSuperAdmin();

  const ROLE_LABELS: Record<string, string> = {
    [Role.SUPER_ADMIN]: t("users.roles.superAdmin"),
    [Role.ADMIN]: t("users.roles.admin"),
    [Role.INSTITUTION_STAFF]: t("users.roles.institutionStaff"),
  };

  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: theme.tabiyaRounding.sm,
        boxShadow: "none",
        border: theme.tabiyaSpacing.sm,
        borderColor: theme.palette.grey["100"],
      }}
      data-testid={DATA_TEST_ID.USERS_TABLE_CONTAINER}
    >
      <Table data-testid={DATA_TEST_ID.USERS_TABLE}>
        <TableHead>
          <TableRow>
            <TableCell>{t("users.table.email")}</TableCell>
            <TableCell>{t("users.table.name")}</TableCell>
            <TableCell>{t("users.table.role")}</TableCell>
            <TableCell>{t("users.table.institutionId")}</TableCell>
            <TableCell>{t("users.table.status")}</TableCell>
            {canManage && <TableCell align="right">{t("users.table.actions")}</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={canManage ? 6 : 5}
                align="center"
                sx={{ py: 4, color: "text.secondary" }}
                data-testid={DATA_TEST_ID.USERS_TABLE_EMPTY}
              >
                {t("users.table.empty")}
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.uid} data-testid={DATA_TEST_ID.USERS_TABLE_ROW}>
                <TableCell>{user.email ?? "\u2014"}</TableCell>
                <TableCell>{user.display_name ?? "\u2014"}</TableCell>
                <TableCell>{user.role ? (ROLE_LABELS[user.role] ?? user.role) : "\u2014"}</TableCell>
                <TableCell>{institutionDisplay(user.institution_id)}</TableCell>
                <TableCell>
                  <Box
                    component="span"
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderRadius: theme.tabiyaRounding.sm,
                      backgroundColor: user.disabled ? theme.palette.grey[300] : theme.palette.success.light,
                      color: user.disabled ? theme.palette.text.primary : theme.palette.success.contrastText,
                      fontSize: "0.75rem",
                      fontWeight: 500,
                    }}
                  >
                    {user.disabled ? t("users.status.inactive") : t("users.status.active")}
                  </Box>
                </TableCell>
                {canManage && (
                  <TableCell align="right">
                    <Tooltip title={t("users.actions.editRole")}>
                      <IconButton
                        size="small"
                        onClick={() => setUpdateUser(user)}
                        data-testid={DATA_TEST_ID.USERS_TABLE_EDIT_BUTTON}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t("users.actions.delete")}>
                      <IconButton
                        size="small"
                        onClick={() => setDeleteUser(user)}
                        data-testid={DATA_TEST_ID.USERS_TABLE_DELETE_BUTTON}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default UsersTable;
