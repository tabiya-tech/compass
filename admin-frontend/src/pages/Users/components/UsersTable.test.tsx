// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { screen } from "@testing-library/react";

import UsersTable, { DATA_TEST_ID } from "./UsersTable";
import { UsersProvider, UsersContextValue } from "../UsersContext";
import { Role, UserRecord } from "../usersService";
import UserStateService from "src/userState/UserStateService";
import { renderWithProviders } from "src/_test_utilities/renderWithProviders";

const buildContext = (users: UserRecord[]): UsersContextValue => ({
  users,
  loading: false,
  error: null,
  clearError: jest.fn(),
  fetchUsers: jest.fn(),
  setCreateModalOpen: jest.fn(),
  setUpdateUser: jest.fn(),
  setDeleteUser: jest.fn(),
  createModalOpen: false,
  updateUser: null,
  deleteUser: null,
});

const buildUser = (overrides: Partial<UserRecord> = {}): UserRecord => ({
  uid: "user-1",
  email: "user@example.com",
  display_name: "Some User",
  phone_number: null,
  photo_url: null,
  disabled: false,
  email_verified: true,
  role: Role.ADMIN,
  institution_id: null,
  ...overrides,
});

const renderTable = (users: UserRecord[]) =>
  renderWithProviders(
    <UsersProvider value={buildContext(users)}>
      <UsersTable />
    </UsersProvider>
  );

describe("UsersTable row-action gating", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test.each([
    ["admin" as const, false],
    ["institution_staff" as const, false],
  ])("hides Edit and Delete buttons when caller is %s", (givenCallerRole, _) => {
    // GIVEN the current caller is not super_admin
    jest.spyOn(UserStateService.getInstance(), "isSuperAdmin").mockReturnValue(false);
    void givenCallerRole; // role label kept for table readability

    // WHEN the table renders with one user row
    renderTable([buildUser()]);

    // THEN no Edit or Delete row buttons are rendered
    expect(screen.queryByTestId(DATA_TEST_ID.USERS_TABLE_EDIT_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByTestId(DATA_TEST_ID.USERS_TABLE_DELETE_BUTTON)).not.toBeInTheDocument();
  });

  test("renders Edit and Delete buttons when caller is super_admin", () => {
    // GIVEN the current caller is super_admin
    jest.spyOn(UserStateService.getInstance(), "isSuperAdmin").mockReturnValue(true);

    // WHEN the table renders with one user row
    renderTable([buildUser()]);

    // THEN both row action buttons are rendered
    expect(screen.getByTestId(DATA_TEST_ID.USERS_TABLE_EDIT_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.USERS_TABLE_DELETE_BUTTON)).toBeInTheDocument();
  });

  test("table itself is still visible to non-super-admin callers (read-only access)", () => {
    // GIVEN the current caller is admin (read-only access)
    jest.spyOn(UserStateService.getInstance(), "isSuperAdmin").mockReturnValue(false);

    // WHEN the table renders with one user row
    renderTable([buildUser({ email: "visible@example.com" })]);

    // THEN the user row is still rendered
    expect(screen.getByTestId(DATA_TEST_ID.USERS_TABLE_ROW)).toBeInTheDocument();
    expect(screen.getByText("visible@example.com")).toBeInTheDocument();
  });
});
