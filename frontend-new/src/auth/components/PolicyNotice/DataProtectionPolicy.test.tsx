import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import DataProtectionAgreement, { DATA_TEST_ID } from "./DataProtectionPolicy";
import { HashRouter, useNavigate } from "react-router-dom";
import { mockLoggedInUser } from "src/_test_utilities/mockLoggedInUser";
import { waitFor } from "@testing-library/react";
import UserPreferencesService from "src/auth/services/UserPreferences/userPreferences.service";
import { Language, UserPreferenceResponse } from "src/auth/services/UserPreferences/userPreferences.types";
import { routerPaths } from "src/app/routerPaths";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { TabiyaUser } from "src/auth/auth.types";
import { mockUseTokens } from "src/_test_utilities/mockUseTokens";

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

// mock the UserPreferencesService
jest.mock("src/auth/services/UserPreferences/userPreferences.service", () => {
  return jest.fn().mockImplementation(() => {
    return {
      getUserPreferences: jest.fn(),
    };
  });
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

describe("Testing Data Protection Policy component with AuthProvider", () => {
  beforeEach(() => {
    // Clear console mocks and mock functions
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  beforeAll(() => mockLoggedInUser({}));
  beforeAll(() => mockUseTokens());

  beforeEach(() => {
    const mockDate = new Date(2023, 5, 14); // June 14, 2023
    //@ts-ignore
    jest.spyOn(global, "Date").mockImplementationOnce(() => mockDate as unknown as Date);
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

    // AND the component should match the snapshot
    expect(screen.getByTestId(DATA_TEST_ID.DPA_CONTAINER)).toMatchSnapshot();
  });

  test("should successfully accept the data protection policy", async () => {
    // GIVEN a user is logged in
    const givenUser: TabiyaUser = {
      id: "0001",
      email: "foo@bar.baz",
      name: "Foo Bar",
    };
    mockLoggedInUser({ user: givenUser });
    const newUserPreferences: UserPreferenceResponse = {
      user_preference_id: "0002",
      user_preferences: {
        user_id: givenUser.id,
        language: Language.en,
        accepted_tc: new Date(),
        sessions: [],
      },
    };

    // AND the user preferences service will successfully create the user preferences
    const userPreferencesServiceMock = {
      createUserPreferences: jest.fn().mockResolvedValue(newUserPreferences),
    };
    (UserPreferencesService as jest.Mock).mockImplementation(() => userPreferencesServiceMock);
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

    // THEN expect the createUserPreferences function to be called
    const expectedUserPreferenceSpecs = {
      user_id: givenUser.id,
      language: Language.en,
      accepted_tc: new Date(),
    };
    await waitFor(() => {
      expect(userPreferencesServiceMock.createUserPreferences).toHaveBeenCalledWith(expectedUserPreferenceSpecs);
    });

    // AND the user should be redirected to the root path
    await waitFor(() => {
      expect(useNavigate()).toHaveBeenCalledWith(routerPaths.ROOT, { replace: true });
    });

    // AND the success message should be displayed
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Data Protection Agreement Accepted", {
        variant: "success",
      });
    });
  });
  test("should fail to accept the data protection policy gracefully", async () => {
    // GIVEN a user is logged in
    const givenUser: TabiyaUser = {
      id: "0001",
      email: "foo@bar.baz",
      name: "Foo Bar",
    };

    mockLoggedInUser({ user: givenUser });

    // AND the user preferences service will fail
    const userPreferencesServiceMock = {
      createUserPreferences: jest.fn().mockRejectedValue(new Error("Failed to create user preferences")),
    };

    (UserPreferencesService as jest.Mock).mockImplementation(() => userPreferencesServiceMock);

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
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON));

    // THEN expect the createUserPreferences function to be called
    const expectedUserPreferenceSpecs = {
      user_id: givenUser.id,
      language: Language.en,
      accepted_tc: new Date(),
    };

    await waitFor(() => {
      expect(userPreferencesServiceMock.createUserPreferences).toHaveBeenCalledWith(expectedUserPreferenceSpecs);
    });

    // AND the error message should be displayed
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to create user preferences", {
        variant: "error",
      });
    });

    // AND the error should be logged
    expect(console.error).toHaveBeenCalledWith("Failed to create user preferences", expect.any(Error));
  });
});
