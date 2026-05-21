import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { usersService, UserRecord } from "./usersService";
import { UsersContextValue } from "./UsersContext";

/**
 * Custom hook that encapsulates user management state and CRUD operations.
 * Provides all state and actions needed by the Users page and its child components.
 */
const useUsers = (): UsersContextValue => {
  const { t } = useTranslation();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [updateUser, setUpdateUser] = useState<UserRecord | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await usersService.listUsers();
      setUsers(response.users);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("users.error.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    clearError,
    fetchUsers,
    createModalOpen,
    setCreateModalOpen,
    updateUser,
    setUpdateUser,
    deleteUser,
    setDeleteUser,
  };
};

export default useUsers;
