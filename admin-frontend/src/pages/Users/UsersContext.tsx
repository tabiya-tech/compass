import React, { createContext, useContext } from "react";
import { UserRecord } from "./usersService";

export interface UsersContextValue {
  users: UserRecord[];
  loading: boolean;
  error: string | null;
  clearError: () => void;
  fetchUsers: () => Promise<void>;
  setCreateModalOpen: (open: boolean) => void;
  setUpdateUser: (user: UserRecord | null) => void;
  setDeleteUser: (user: UserRecord | null) => void;
  createModalOpen: boolean;
  updateUser: UserRecord | null;
  deleteUser: UserRecord | null;
}

const UsersContext = createContext<UsersContextValue | undefined>(undefined);

export const useUsersContext = (): UsersContextValue => {
  const context = useContext(UsersContext);
  if (!context) {
    throw new Error("useUsersContext must be used within a UsersProvider");
  }
  return context;
};

export const UsersProvider: React.FC<{ value: UsersContextValue; children: React.ReactNode }> = ({
  value,
  children,
}) => {
  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
};

export default UsersContext;
