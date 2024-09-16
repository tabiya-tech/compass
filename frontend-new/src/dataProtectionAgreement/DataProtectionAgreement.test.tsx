import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import DataProtectionAgreement, { DATA_TEST_ID } from "./DataProtectionAgreement";
import { HashRouter, useNavigate } from "react-router-dom";
import { waitFor } from "@testing-library/react";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { TabiyaUser } from "src/auth/auth.types";
import { userPreferencesStateService } from "src/userPreferences/UserPreferencesProvider/UserPreferencesStateService";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import authStateService from "src/auth/AuthStateService";

// Mock the envService module
jest.mock("src/envService", () => ({
  getFirebaseAPIKey: jest.fn(() => "mock-api-key"),
  getFirebaseDomain: jest.fn(() => "mock-auth-domain"),
  getBackendUrl: jest.fn(() => "mock-backend-url"),
}));

// mock the snack bar provider
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      enqueueSnackbar: jest.fn(),
      closeSnackbar: jest.fn(),
    }),
  };
});

// mock the router
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    __esModule: true,
    useNavigate: jest.fn().mockReturnValue(jest.fn()),
    NavLink: jest.fn().mockImplementation(() => {
      return <></>;
    }),
  };
});

describe("Testing Data Protection Policy component", () => {
  beforeEach(() => {
    // Clear console mocks and mock functions
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    const mockDate = new Date(2023, 5, 14); // June 14, 2023
    jest.spyOn(global, "Date").mockImplementation(() => mockDate);
  });

  test("it should show data protection policy", async () => {
    // WHEN the component is rendered
    render(
      <HashRouter>
        <DataProtectionAgreement />
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the component should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.DPA_CONTAINER)).toBeDefined();

    // AND the agreement body should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.AGREEMENT_BODY)).toBeInTheDocument();

    // AND the accept button should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON)).toBeInTheDocument();

    // AND the accept checkbox should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_CHECKBOX)).toBeInTheDocument();

    // AND the terms and conditions should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.TERMS_AND_CONDITIONS)).toBeInTheDocument();

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.DPA_CONTAINER)).toMatchSnapshot();
  });

  test("should successfully accept the data protection policy", async () => {
    // GIVEN the user preferences state service is mocked to set the user preferences
    jest.spyOn(userPreferencesStateService, "setUserPreferences").mockImplementation(() => {});

    // WHEN the component is rendered
    render(
      <HashRouter>
        <DataProtectionAgreement />
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the accept button should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON)).toBeInTheDocument();

    // WHEN the user clicks the accept button
    // AND WHEN the accept button is clicked
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON));
  });

  test("should fail to accept the data protection policy gracefully", async () => {
    // GIVEN a user is logged in
    const givenUser: TabiyaUser = {
      id: "0001",
      email: "foo@bar.baz",
      name: "Foo Bar",
    };

    // AND the user preferences service is mocked to throw an error
    jest
      .spyOn(userPreferencesService, "updateUserPreferences")
      .mockRejectedValue(new Error("Failed to update user preferences"));

    // AND the authStateService is mocked to return the given user
    jest.spyOn(authStateService, "getUser").mockImplementation(() => givenUser);

    // WHEN the component is rendered
    render(
      <HashRouter>
        <DataProtectionAgreement />
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the user accepts the terms and conditions
    const checkBoxWrapper = screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_CHECKBOX);
    expect(checkBoxWrapper).toBeInTheDocument();

    // WHEN the user clicks the checkbox
    const checkBoxInput = screen.getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(checkBoxInput);

    // THEN expect the checkbox to be checked
    expect(checkBoxInput.checked).toBe(true);

    // AND the accept button should be enabled
    const acceptButton = screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON);
    expect(acceptButton).toBeEnabled();

    // WHEN the user clicks the accept button
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON));

    await waitFor(() => {
      expect(useNavigate()).not.toHaveBeenCalled();
    });

    // AND the error message should be displayed
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(
        "Failed to update user preferences: Failed to update user preferences",
        {
          variant: "error",
        }
      );
    });

    // AND the error should be logged
    expect(console.error).toHaveBeenCalled();
  });
});
