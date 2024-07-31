import "src/_test_utilities/consoleMock";
import React from "react";
import { render, screen, fireEvent } from "src/_test_utilities/test-utils";
import DataProtectionAgreement, { DATA_TEST_ID } from "./DataProtectionAgreement";
import { HashRouter } from "react-router-dom";
import { mockLoggedInUser } from "src/_test_utilities/mockLoggedInUser";
import { waitFor } from "@testing-library/react";
import { Language, UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { TabiyaUser } from "src/auth/auth.types";
import { mockUseTokens } from "src/_test_utilities/mockUseTokens";
import { UserPreferencesContext } from "src/userPreferences/UserPreferencesProvider/UserPreferencesProvider";

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
jest.mock("src/userPreferences/UserPreferencesService/userPreferences.service", () => {
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

describe("Testing Data Protection Policy component", () => {
  const createUserPreferencesMock = jest.fn();

  const userPreferencesContextValue = {
    getUserPreferences: jest.fn(),
    createUserPreferences: createUserPreferencesMock,
    userPreferences: {
      accepted_tc: new Date(),
      user_id: "0001",
      language: Language.en,
      sessions: [],
    },
    updateUserPreferences: jest.fn(),
    isLoading: false,
  };
  const givenNotifyOnAcceptDPA = jest.fn();
  const givenIsLoading = false;

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
    jest.spyOn(global, "Date").mockImplementation(() => mockDate);
  });

  test("it should show data protection policy", async () => {
    // WHEN the component is rendered
    render(
      <HashRouter>
        <UserPreferencesContext.Provider value={userPreferencesContextValue}>
          <DataProtectionAgreement notifyOnAcceptDPA={givenNotifyOnAcceptDPA} isLoading={givenIsLoading} />
        </UserPreferencesContext.Provider>
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
    const newUserPreferences: UserPreference = {
      user_id: givenUser.id,
      language: Language.en,
      accepted_tc: new Date(),
      sessions: [],
    };

    // AND the user preferences provider will create the user preferences
    createUserPreferencesMock.mockImplementation((newUserPrefs, onSuccess, onError) => {
      onSuccess(newUserPreferences);
    });

    // WHEN the component is rendered
    render(
      <HashRouter>
        <UserPreferencesContext.Provider value={userPreferencesContextValue}>
          <DataProtectionAgreement notifyOnAcceptDPA={givenNotifyOnAcceptDPA} isLoading={givenIsLoading} />
        </UserPreferencesContext.Provider>
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

    await waitFor(() => {
      expect(givenNotifyOnAcceptDPA).toHaveBeenCalled();
    });

    // AND the user should be redirected to the root path
    await waitFor(() => {
      expect(givenNotifyOnAcceptDPA).toHaveBeenCalled();
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

    // AND the user preferences provider will fail to create the user preferences
    createUserPreferencesMock.mockImplementation((newUserPrefs, onSuccess, onError) => {
      onError(new Error("Failed to create user preferences"));
    });

    // WHEN the component is rendered
    render(
      <HashRouter>
        <UserPreferencesContext.Provider value={userPreferencesContextValue}>
          <DataProtectionAgreement notifyOnAcceptDPA={givenNotifyOnAcceptDPA} isLoading={givenIsLoading} />
        </UserPreferencesContext.Provider>
      </HashRouter>
    );

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND the accept button should be rendered
    expect(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON)).toBeInTheDocument();

    // WHEN the user clicks the accept button
    fireEvent.click(screen.getByTestId(DATA_TEST_ID.ACCEPT_DPA_BUTTON));

    await waitFor(() => {
      expect(givenNotifyOnAcceptDPA).not.toHaveBeenCalled();
    });

    // AND the error message should be displayed
    await waitFor(() => {
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to create user preferences", {
        variant: "error",
      });
    });

    // AND the error should be logged
    expect(console.error).toHaveBeenCalled();
  });
});
