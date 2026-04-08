import React from "react";
import { Alert, Box, Button, Container, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import Header from "src/components/Header/Header";
import Footer from "src/components/Footer/Footer";
import { UsersProvider } from "./UsersContext";
import useUsers from "./useUsers";
import UsersTable, { UsersTableSkeleton } from "./components/UsersTable";
import CreateUserModal from "./components/CreateUserModal";
import UpdateRoleModal from "./components/UpdateRoleModal";
import DeleteUserModal from "./components/DeleteUserModal";

const uniqueId = "users-page-2b4d6f8a-0c1e-2d3f-4a5b-6c7d8e9f0a1b";

export const DATA_TEST_ID = {
  USERS_PAGE_CONTAINER: `${uniqueId}-container`,
  USERS_PAGE_TITLE: `${uniqueId}-title`,
  USERS_PAGE_ADD_BUTTON: `${uniqueId}-add-button`,
};

export interface UsersProps {}

/**
 * Users page content that consumes the UsersContext.
 * Renders the page header with the title and add button, error/loading states, and the users table.
 */
const UsersContent: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const usersContext = useUsers();

  return (
    <UsersProvider value={usersContext}>
      <Container maxWidth="lg" data-testid={DATA_TEST_ID.USERS_PAGE_CONTAINER}>
        <Box sx={{ py: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Typography variant="h4" component="h1" data-testid={DATA_TEST_ID.USERS_PAGE_TITLE}>
              {t("users.title", "Users")}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => usersContext.setCreateModalOpen(true)}
              data-testid={DATA_TEST_ID.USERS_PAGE_ADD_BUTTON}
            >
              {t("users.addUser", "Add User")}
            </Button>
          </Box>

          {usersContext.error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={usersContext.clearError}>
              {usersContext.error}
            </Alert>
          )}

          {usersContext.loading ? <UsersTableSkeleton /> : <UsersTable />}
        </Box>
      </Container>

      <CreateUserModal />
      <UpdateRoleModal />
      <DeleteUserModal />
    </UsersProvider>
  );
};

/**
 * Users page with Navbar header and user management functionality.
 * Wraps the content in a full-page layout with navigation bar consistent with other pages.
 */
const Users: React.FC<UsersProps> = () => {
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
