import React, { useEffect, useState } from "react";
import { Alert, Badge, Box, Button, Container, Tab, Tabs, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import Header from "src/components/Header/Header";
import Footer from "src/components/Footer/Footer";
import UserStateService from "src/userState/UserStateService";
import { UsersProvider } from "./UsersContext";
import useUsers from "./useUsers";
import UsersTable, { UsersTableSkeleton } from "./components/UsersTable";
import CreateUserModal from "./components/CreateUserModal";
import UpdateRoleModal from "./components/UpdateRoleModal";
import DeleteUserModal from "./components/DeleteUserModal";
import RegistrationsTable from "./components/PendingRegistrations/RegistrationsTable";
import ApproveModal from "./components/PendingRegistrations/ApproveModal";
import RejectModal from "./components/PendingRegistrations/RejectModal";
import {
  usePendingRegistrations,
  UsePendingRegistrationsValue,
} from "./components/PendingRegistrations/usePendingRegistrations";
import { AdminRegistration } from "src/pages/Register/registrationsService";

const uniqueId = "users-page-2b4d6f8a-0c1e-2d3f-4a5b-6c7d8e9f0a1b";

export const DATA_TEST_ID = {
  USERS_PAGE_CONTAINER: `${uniqueId}-container`,
  USERS_PAGE_TITLE: `${uniqueId}-title`,
  USERS_PAGE_ADD_BUTTON: `${uniqueId}-add-button`,
  USERS_TAB_ACTIVE: `${uniqueId}-tab-active`,
  USERS_TAB_PENDING: `${uniqueId}-tab-pending`,
};

type TabKey = "active" | "pending";

interface PendingTabContentProps {
  pending: UsePendingRegistrationsValue;
}

const PendingTabContent: React.FC<PendingTabContentProps> = ({ pending }) => {
  const { t } = useTranslation();
  const { registrations, loading, error, approve, reject } = pending;
  const [approveTarget, setApproveTarget] = useState<AdminRegistration | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminRegistration | null>(null);

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {loading ? (
        <Typography color="text.secondary">{t("registrations.loading")}</Typography>
      ) : (
        <RegistrationsTable registrations={registrations} onApprove={setApproveTarget} onReject={setRejectTarget} />
      )}
      <ApproveModal registration={approveTarget} onClose={() => setApproveTarget(null)} onConfirm={approve} />
      <RejectModal registration={rejectTarget} onClose={() => setRejectTarget(null)} onConfirm={reject} />
    </>
  );
};

const UsersContent: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const usersContext = useUsers();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSuperAdmin = UserStateService.getInstance().isSuperAdmin();

  const requestedTab = searchParams.get("tab");
  const initialTab: TabKey = requestedTab === "pending" && isSuperAdmin ? "pending" : "active";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // If the URL says ?tab=pending but the user lacks privilege, snap back to active.
  useEffect(() => {
    if (!isSuperAdmin && activeTab === "pending") {
      setActiveTab("active");
    }
  }, [isSuperAdmin, activeTab]);

  const handleTabChange = (_event: React.SyntheticEvent, value: TabKey) => {
    setActiveTab(value);
    const next = new URLSearchParams(searchParams);
    if (value === "active") {
      next.delete("tab");
    } else {
      next.set("tab", value);
    }
    setSearchParams(next, { replace: true });
  };

  const pending = usePendingRegistrations(isSuperAdmin);
  const { pendingCount } = pending;

  return (
    <UsersProvider value={usersContext}>
      <Container maxWidth="lg" data-testid={DATA_TEST_ID.USERS_PAGE_CONTAINER}>
        <Box sx={{ py: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Typography variant="h4" component="h1" data-testid={DATA_TEST_ID.USERS_PAGE_TITLE}>
              {t("users.title")}
            </Typography>
            {isSuperAdmin && activeTab === "active" && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => usersContext.setCreateModalOpen(true)}
                data-testid={DATA_TEST_ID.USERS_PAGE_ADD_BUTTON}
              >
                {t("users.addUser")}
              </Button>
            )}
          </Box>

          {isSuperAdmin && (
            <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
              <Tab label={t("users.tabs.active")} value="active" data-testid={DATA_TEST_ID.USERS_TAB_ACTIVE} />
              <Tab
                label={
                  pendingCount > 0 ? (
                    <Badge color="warning" badgeContent={pendingCount} sx={{ pr: 2 }}>
                      {t("users.tabs.pending")}
                    </Badge>
                  ) : (
                    t("users.tabs.pending")
                  )
                }
                value="pending"
                data-testid={DATA_TEST_ID.USERS_TAB_PENDING}
              />
            </Tabs>
          )}

          {activeTab === "active" ? (
            <>
              {usersContext.error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={usersContext.clearError}>
                  {usersContext.error}
                </Alert>
              )}
              {usersContext.loading ? <UsersTableSkeleton /> : <UsersTable />}
            </>
          ) : (
            <PendingTabContent pending={pending} />
          )}
        </Box>
      </Container>

      <CreateUserModal />
      <UpdateRoleModal />
      <DeleteUserModal />
    </UsersProvider>
  );
};

const Users: React.FC = () => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Header />
      <Box sx={{ flex: 1 }}>
        <UsersContent />
      </Box>
      <Footer />
    </Box>
  );
};

export default Users;
