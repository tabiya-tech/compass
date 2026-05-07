// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { screen } from "@testing-library/react";

import Users, { DATA_TEST_ID } from "./Users";
import UserStateService from "src/userState/UserStateService";
import { renderWithProviders } from "src/_test_utilities/renderWithProviders";
import { usersService } from "./usersService";
import { registrationsService } from "src/pages/Register/registrationsService";

jest.mock("./usersService", () => {
  const actual = jest.requireActual("./usersService");
  return {
    ...actual,
    usersService: {
      listUsers: jest.fn().mockResolvedValue({ users: [], next_page_token: null }),
      createUser: jest.fn(),
      deleteUser: jest.fn(),
      updateRole: jest.fn(),
      updateProfile: jest.fn(),
    },
  };
});

jest.mock("src/pages/Register/registrationsService", () => ({
  registrationsService: {
    list: jest.fn().mockResolvedValue({ registrations: [], pending_count: 0 }),
    submit: jest.fn(),
    getStatus: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
  },
  RegistrationStatus: { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" },
  RegistrationRoleRequest: { ADMIN: "admin", INSTITUTION_STAFF: "institution_staff" },
}));

jest.mock("src/components/Header/Header", () => () => <div data-testid="mock-header" />);
jest.mock("src/components/Footer/Footer", () => () => <div data-testid="mock-footer" />);
jest.mock("./components/CreateUserModal", () => () => <div data-testid="mock-create-modal" />);
jest.mock("./components/UpdateRoleModal", () => () => <div data-testid="mock-update-modal" />);
jest.mock("./components/DeleteUserModal", () => () => <div data-testid="mock-delete-modal" />);
jest.mock("./components/PendingRegistrations/RegistrationsTable", () => () => (
  <div data-testid="mock-registrations-table" />
));
jest.mock("./components/PendingRegistrations/ApproveModal", () => () => null);
jest.mock("./components/PendingRegistrations/RejectModal", () => () => null);

const renderUsers = (initialPath = "/users") => renderWithProviders(<Users />, { initialEntries: [initialPath] });

describe("Users page tabs and gating", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usersService.listUsers as jest.Mock).mockResolvedValue({ users: [], next_page_token: null });
    (registrationsService.list as jest.Mock).mockResolvedValue({ registrations: [], pending_count: 0 });
  });

  test("does NOT render the Pending Sign-ups tab when caller is not super_admin", () => {
    // GIVEN the current caller is admin (not super_admin)
    jest.spyOn(UserStateService.getInstance(), "isSuperAdmin").mockReturnValue(false);

    // WHEN the page renders
    renderUsers();

    // THEN the Pending Sign-ups tab is not in the document
    expect(screen.queryByTestId(DATA_TEST_ID.USERS_TAB_PENDING)).not.toBeInTheDocument();
    // AND neither is the Active Users tab (single-tab UI collapses Tabs entirely)
    expect(screen.queryByTestId(DATA_TEST_ID.USERS_TAB_ACTIVE)).not.toBeInTheDocument();
  });

  test("hides Add User button when caller is not super_admin", () => {
    // GIVEN the current caller is admin (not super_admin)
    jest.spyOn(UserStateService.getInstance(), "isSuperAdmin").mockReturnValue(false);

    // WHEN the page renders
    renderUsers();

    // THEN no Add User button is rendered
    expect(screen.queryByTestId(DATA_TEST_ID.USERS_PAGE_ADD_BUTTON)).not.toBeInTheDocument();
  });

  test("renders both tabs and the Add User button when caller is super_admin", () => {
    // GIVEN the current caller is super_admin
    jest.spyOn(UserStateService.getInstance(), "isSuperAdmin").mockReturnValue(true);

    // WHEN the page renders
    renderUsers();

    // THEN both tabs are rendered
    expect(screen.getByTestId(DATA_TEST_ID.USERS_TAB_ACTIVE)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.USERS_TAB_PENDING)).toBeInTheDocument();
    // AND the Add User button is rendered
    expect(screen.getByTestId(DATA_TEST_ID.USERS_PAGE_ADD_BUTTON)).toBeInTheDocument();
  });

  test("opens the Pending Sign-ups tab when ?tab=pending is in the URL and caller is super_admin", async () => {
    // GIVEN the current caller is super_admin and the URL requests the pending tab
    jest.spyOn(UserStateService.getInstance(), "isSuperAdmin").mockReturnValue(true);

    // WHEN the page renders with ?tab=pending
    renderUsers("/users?tab=pending");

    // THEN the registrations table is rendered after the pending fetch resolves
    expect(await screen.findByTestId("mock-registrations-table")).toBeInTheDocument();
  });
});
