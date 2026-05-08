import React from "react";
import {
  Box,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  useTheme,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { useTranslation } from "react-i18next";
import { AdminRegistration, RegistrationRoleRequest } from "src/pages/Register/registrationsService";
import { decodeInstitutionId } from "src/utils/institutionUtils";

function institutionDisplay(institutionId: string | null | undefined): string {
  if (!institutionId) return "—";
  try {
    return decodeInstitutionId(institutionId);
  } catch {
    return institutionId;
  }
}

const uniqueId = "registrations-table-4d6f8a0b-2c1e-3f4a-5b6c-7d8e9f0a1b2c";

export const DATA_TEST_ID = {
  TABLE_CONTAINER: `${uniqueId}-container`,
  TABLE: `${uniqueId}-table`,
  TABLE_ROW: `${uniqueId}-table-row`,
  TABLE_EMPTY: `${uniqueId}-empty`,
  APPROVE_BUTTON: `${uniqueId}-approve-button`,
  REJECT_BUTTON: `${uniqueId}-reject-button`,
};

const ROLE_LABELS: Record<string, string> = {
  [RegistrationRoleRequest.ADMIN]: "Cross-institution admin",
  [RegistrationRoleRequest.INSTITUTION_STAFF]: "Instructor",
};

export interface RegistrationsTableProps {
  registrations: AdminRegistration[];
  onApprove: (registration: AdminRegistration) => void;
  onReject: (registration: AdminRegistration) => void;
}

const RegistrationsTable: React.FC<RegistrationsTableProps> = ({ registrations, onApprove, onReject }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: theme.tabiyaRounding.sm,
        boxShadow: "none",
        border: theme.tabiyaSpacing.sm,
        borderColor: theme.palette.grey["100"],
      }}
      data-testid={DATA_TEST_ID.TABLE_CONTAINER}
    >
      <Table data-testid={DATA_TEST_ID.TABLE}>
        <TableHead>
          <TableRow>
            <TableCell>{t("registrations.table.email", "Email")}</TableCell>
            <TableCell>{t("registrations.table.name", "Name")}</TableCell>
            <TableCell>{t("registrations.table.role", "Requested role")}</TableCell>
            <TableCell>{t("registrations.table.institution", "Institution")}</TableCell>
            <TableCell>{t("registrations.table.submittedAt", "Submitted")}</TableCell>
            <TableCell align="right">{t("registrations.table.actions", "Actions")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {registrations.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                align="center"
                sx={{ py: 4, color: "text.secondary" }}
                data-testid={DATA_TEST_ID.TABLE_EMPTY}
              >
                {t("registrations.table.empty", "No pending sign-ups")}
              </TableCell>
            </TableRow>
          ) : (
            registrations.map((registration) => (
              <TableRow key={registration.id} data-testid={DATA_TEST_ID.TABLE_ROW}>
                <TableCell>{registration.email}</TableCell>
                <TableCell>{registration.name}</TableCell>
                <TableCell>{ROLE_LABELS[registration.requested_role] ?? registration.requested_role}</TableCell>
                <TableCell>{institutionDisplay(registration.institution_id)}</TableCell>
                <TableCell>{new Date(registration.submitted_at).toLocaleString()}</TableCell>
                <TableCell align="right">
                  <Box sx={{ display: "inline-flex", gap: 0.5 }}>
                    <Tooltip title={t("registrations.actions.approve", "Approve")}>
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => onApprove(registration)}
                        data-testid={DATA_TEST_ID.APPROVE_BUTTON}
                      >
                        <CheckCircleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t("registrations.actions.reject", "Reject")}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => onReject(registration)}
                        data-testid={DATA_TEST_ID.REJECT_BUTTON}
                      >
                        <CancelIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default RegistrationsTable;
