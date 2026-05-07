// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Register, { DATA_TEST_ID } from "./Register";
import { registrationsService, RegistrationStatus } from "./registrationsService";
import { HttpError } from "src/pages/Users/usersService";
import { renderWithProviders } from "src/_test_utilities/renderWithProviders";

jest.mock("./registrationsService", () => {
  const actual = jest.requireActual("./registrationsService");
  return {
    ...actual,
    registrationsService: {
      submit: jest.fn(),
      getStatus: jest.fn(),
      list: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
    },
  };
});

jest.mock("./usePublicInstitutionOptions", () => ({
  usePublicInstitutionOptions: () => ({
    options: [{ id: "inst-1", name: "Copperbelt University" }],
    loading: false,
    error: null,
  }),
}));

jest.mock("src/pages/Users/components/InstitutionAutocomplete", () => {
  const Mock = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="mock-institution-autocomplete" value={value} onChange={(e) => onChange(e.target.value)} />
  );
  return { __esModule: true, default: Mock };
});

const renderPage = () => renderWithProviders(<Register />);

const typeIntoLabelledField = async (label: RegExp, value: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(label), value);
};

describe("Register page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("submits an instructor request and shows the success view", async () => {
    // GIVEN the registration service accepts the submission
    (registrationsService.submit as jest.Mock).mockResolvedValue({
      id: "65a",
      status: RegistrationStatus.PENDING,
    });
    const givenEmail = "alice@school.edu";
    const givenName = "Alice Test";
    const givenInstitutionId = "inst-1";
    const user = userEvent.setup();

    // WHEN the user fills out the form for an instructor signup and submits
    renderPage();
    await typeIntoLabelledField(/email/i, givenEmail);
    await typeIntoLabelledField(/full name/i, givenName);
    // role defaults to INSTITUTION_STAFF
    const institutionInput = screen.getByTestId("mock-institution-autocomplete") as HTMLInputElement;
    await user.type(institutionInput, givenInstitutionId);
    await user.click(screen.getByTestId(DATA_TEST_ID.REGISTER_PAGE_SUBMIT));

    // THEN the success alert is shown
    await waitFor(() => {
      expect(screen.getByTestId(DATA_TEST_ID.REGISTER_PAGE_SUCCESS)).toBeInTheDocument();
    });
    // AND the service was called with the expected payload
    expect(registrationsService.submit).toHaveBeenCalledWith({
      email: givenEmail,
      name: givenName,
      requested_role: "institution_staff",
      institution_id: givenInstitutionId,
    });
  });

  test("disables submit when institution is missing for an instructor signup", () => {
    // GIVEN no institution selected and the role defaults to instructor
    // WHEN the page renders without filling institution
    renderPage();

    // THEN the submit button is disabled (form is invalid)
    expect(screen.getByTestId(DATA_TEST_ID.REGISTER_PAGE_SUBMIT)).toBeDisabled();
  });

  test("shows the duplicate-active message on a 409 response", async () => {
    // GIVEN the registration service rejects with a 409
    (registrationsService.submit as jest.Mock).mockRejectedValue(
      new HttpError(409, "An active registration already exists for this email.")
    );
    const user = userEvent.setup();

    // WHEN the user submits a request that conflicts with an existing pending row
    renderPage();
    await typeIntoLabelledField(/email/i, "alice@school.edu");
    await typeIntoLabelledField(/full name/i, "Alice Test");
    const institutionInput = screen.getByTestId("mock-institution-autocomplete") as HTMLInputElement;
    await user.type(institutionInput, "inst-1");
    await user.click(screen.getByTestId(DATA_TEST_ID.REGISTER_PAGE_SUBMIT));

    // THEN the duplicate-active error message is rendered
    await waitFor(() => {
      expect(screen.getByText("An active registration already exists for this email.")).toBeInTheDocument();
    });
  });

  test("does NOT offer a Super Admin role choice in the public role select", async () => {
    // GIVEN the page is rendered
    const user = userEvent.setup();
    renderPage();

    // WHEN the role select is expanded
    const roleControl = screen.getByTestId(DATA_TEST_ID.REGISTER_PAGE_ROLE);
    await user.click(within(roleControl).getByRole("combobox"));

    // THEN no Super Admin option is offered (super_admin must never be self-requestable)
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).queryByText(/super.?admin/i)).not.toBeInTheDocument();
    expect(within(listbox).getByText("Instructor")).toBeInTheDocument();
    expect(within(listbox).getByText("Cross-institution admin")).toBeInTheDocument();
  });
});
