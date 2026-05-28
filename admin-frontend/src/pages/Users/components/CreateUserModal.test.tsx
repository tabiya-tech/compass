// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CreateUserModal, { DATA_TEST_ID } from "./CreateUserModal";
import { UsersProvider, UsersContextValue } from "../UsersContext";
import UserStateService from "src/userState/UserStateService";
import { renderWithProviders } from "src/_test_utilities/renderWithProviders";
import { usersService } from "../usersService";

jest.mock("./InstitutionAutocomplete", () => {
  const Mock = () => <div data-testid="mock-institution-autocomplete" />;
  return {
    __esModule: true,
    default: Mock,
    useInstitutionOptions: () => ({ options: [], loading: false, error: null }),
  };
});

jest.mock("../usersService", () => {
  const actual = jest.requireActual("../usersService");
  return {
    ...actual,
    usersService: {
      ...actual.usersService,
      createUser: jest.fn(),
      getPasswordResetLink: jest.fn(),
    },
  };
});

const buildOpenContext = (): UsersContextValue => ({
  users: [],
  loading: false,
  error: null,
  clearError: jest.fn(),
  fetchUsers: jest.fn(),
  setCreateModalOpen: jest.fn(),
  setUpdateUser: jest.fn(),
  setDeleteUser: jest.fn(),
  createModalOpen: true,
  updateUser: null,
  deleteUser: null,
});

const renderModal = () =>
  renderWithProviders(
    <UsersProvider value={buildOpenContext()}>
      <CreateUserModal />
    </UsersProvider>
  );

describe("CreateUserModal role select", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("renders the Super Admin option when caller is super_admin", async () => {
    // GIVEN the current caller is super_admin
    jest.spyOn(UserStateService.getInstance(), "isSuperAdmin").mockReturnValue(true);
    const user = userEvent.setup();

    // WHEN the modal opens and the role dropdown is expanded
    renderModal();
    const roleControl = screen.getByTestId(DATA_TEST_ID.CREATE_USER_MODAL_ROLE);
    await user.click(within(roleControl).getByRole("combobox"));

    // THEN the Super Admin option is offered
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByText("Super Admin")).toBeInTheDocument();
    expect(within(listbox).getByText("Admin")).toBeInTheDocument();
    expect(within(listbox).getByText("Institution Staff")).toBeInTheDocument();
  });

  test("shows the password reset link after the user is created", async () => {
    // GIVEN super_admin caller, valid form input, createUser and getPasswordResetLink succeed
    jest.spyOn(UserStateService.getInstance(), "isSuperAdmin").mockReturnValue(true);
    const givenEmail = "newadmin@org.edu";
    const givenLink = "https://auth.example.com/reset?oobCode=abc123";
    (usersService.createUser as jest.Mock).mockResolvedValue({
      uid: "uid-9",
      email: givenEmail,
      display_name: "New Admin",
      role: "admin",
      institution_id: null,
    });
    (usersService.getPasswordResetLink as jest.Mock).mockResolvedValue({ reset_link: givenLink });
    const user = userEvent.setup();

    // WHEN the modal is filled out and submitted (default role is Admin → no institution required)
    renderModal();
    await user.type(screen.getByLabelText(/email/i), givenEmail);
    await user.type(screen.getByLabelText(/display name/i), "New Admin");
    await user.click(screen.getByTestId(DATA_TEST_ID.CREATE_USER_MODAL_SUBMIT));

    // THEN the reset link is displayed for the super admin to copy
    expect(await screen.findByDisplayValue(givenLink)).toBeInTheDocument();
    expect(screen.getByTestId(DATA_TEST_ID.CREATE_USER_MODAL_COPY_LINK)).toBeInTheDocument();
  });

  test("hides the Super Admin option when caller is not super_admin", async () => {
    // GIVEN the current caller is not super_admin (defensive — modal is also already gated outside)
    jest.spyOn(UserStateService.getInstance(), "isSuperAdmin").mockReturnValue(false);
    const user = userEvent.setup();

    // WHEN the modal opens and the role dropdown is expanded
    renderModal();
    const roleControl = screen.getByTestId(DATA_TEST_ID.CREATE_USER_MODAL_ROLE);
    await user.click(within(roleControl).getByRole("combobox"));

    // THEN only Admin and Institution Staff options are offered
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).queryByText("Super Admin")).not.toBeInTheDocument();
    expect(within(listbox).getByText("Admin")).toBeInTheDocument();
    expect(within(listbox).getByText("Institution Staff")).toBeInTheDocument();
  });
});
