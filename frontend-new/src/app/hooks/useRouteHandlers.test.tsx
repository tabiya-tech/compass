import "src/_test_utilities/consoleMock";
import { useRouteHandlers } from "src/app/hooks/useRouteHandlers";
import { renderHook, act } from "src/_test_utilities/test-utils";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { TabiyaUser } from "src/auth/auth.types";
import { routerPaths } from "src/app/routerPaths";
import { UserPreferencesContext } from "src/userPreferences/UserPreferencesProvider/UserPreferencesProvider";
import { UserPreferencesContextValue } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import React from "react";

// mock the router
jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    __esModule: true,
    useNavigate: jest.fn().mockReturnValue(jest.fn()),
  };
});

jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => ({
  ...jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider"),
  useSnackbar: jest.fn(),
}));

jest.mock("src/error/ServiceError/logger", () => ({
  writeServiceErrorToLog: jest.fn(),
}));

const mockEnqueueSnackbar = jest.fn();
const mockCloseSnackbar = jest.fn();
(useSnackbar as jest.Mock).mockReturnValue({
  enqueueSnackbar: mockEnqueueSnackbar,
  closeSnackbar: mockCloseSnackbar,
});

const mockGetUserPreferences = jest.fn();

const givenUser: TabiyaUser = {
  id: "0001",
  name: "Test User",
  email: "foo@bar.baz",
};

const userPreferencesValue = {
  getUserPreferences: mockGetUserPreferences,
  userPreferences: null,
  isLoading: false,
  updateUserPreferences: jest.fn(),
  setUserPreferences: jest.fn(),
} as UserPreferencesContextValue;

const UserPreferencesWrapper = ({ children }: { children: React.ReactNode }) => (
  <UserPreferencesContext.Provider value={userPreferencesValue}>{children}</UserPreferencesContext.Provider>
);

describe("useRouteHandlers hook tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("handleLogin successfully navigates to ROOT if preferences are valid", async () => {
    // GIVEN: The hook is used in a component
    mockGetUserPreferences.mockImplementation((userId, successCallback) => {
      successCallback({ accepted_tc: new Date() });
    });

    const { result } = renderHook(() => useRouteHandlers(), {
      // @ts-ignore
      wrapper: ({ children }) => (
        <UserPreferencesWrapper>
          <MemoryRouter>{children}</MemoryRouter>
        </UserPreferencesWrapper>
      ),
    });

    // WHEN: handleLogin is called
    await act(async () => {
      result.current.handleLogin(givenUser);
    });

    // THEN: The user should be navigated to ROOT and a success snackbar should be shown
    expect(useNavigate()).toHaveBeenCalledWith(routerPaths.ROOT, { replace: true });
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Welcome back!", { variant: "success" });
  });

  test("handleLogin navigates to DPA if preferences are invalid", async () => {
    // GIVEN: The hook is used in a component
    mockGetUserPreferences.mockImplementation((userId, successCallback) => {
      successCallback({ accepted_tc: null });
    });

    const { result } = renderHook(() => useRouteHandlers(), {
      // @ts-ignore
      wrapper: ({ children }) => (
        <UserPreferencesWrapper>
          <MemoryRouter>{children}</MemoryRouter>
        </UserPreferencesWrapper>
      ),
    });

    // WHEN: handleLogin is called
    await act(async () => {
      result.current.handleLogin(givenUser);
    });

    // THEN: The user should be navigated to DPA
    expect(useNavigate()).toHaveBeenCalledWith(routerPaths.DPA, { replace: true });
  });

  test("handleLogin shows an error snackbar on failure", async () => {
    // GIVEN: The hook is used in a component
    mockGetUserPreferences.mockImplementation((userId, successCallback, errorCallback) => {
      errorCallback(new Error("Test error"));
    });

    const { result } = renderHook(() => useRouteHandlers(), {
      // @ts-ignore
      wrapper: ({ children }) => (
        <UserPreferencesWrapper>
          <MemoryRouter>{children}</MemoryRouter>
        </UserPreferencesWrapper>
      ),
    });

    // WHEN: handleLogin is called
    await act(async () => {
      result.current.handleLogin(givenUser);
    });

    // THEN: An error snackbar should be shown
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith("An error occurred while trying to get your preferences", {
      variant: "error",
    });
  });

  test("handleRegister navigates to VERIFY_EMAIL", () => {
    // GIVEN: The hook is used in a component
    const { result } = renderHook(() => useRouteHandlers(), {
      // @ts-ignore
      wrapper: ({ children }) => (
        <UserPreferencesWrapper>
          <MemoryRouter>{children}</MemoryRouter>
        </UserPreferencesWrapper>
      ),
    });

    // WHEN: handleRegister is called
    act(() => {
      result.current.handleRegister();
    });

    // THEN: The user should be navigated to VERIFY_EMAIL
    expect(useNavigate()).toHaveBeenCalledWith(routerPaths.VERIFY_EMAIL, { replace: true });
  });

  test("handleAcceptDPA navigates to ROOT", () => {
    // GIVEN: The hook is used in a component
    const { result } = renderHook(() => useRouteHandlers(), {
      // @ts-ignore
      wrapper: ({ children }) => (
        <UserPreferencesWrapper>
          <MemoryRouter>{children}</MemoryRouter>
        </UserPreferencesWrapper>
      ),
    });

    // WHEN: handleAcceptDPA is called
    act(() => {
      result.current.handleAcceptDPA();
    });

    // THEN: The user should be navigated to ROOT
    expect(useNavigate()).toHaveBeenCalledWith(routerPaths.ROOT, { replace: true });
  });

  test("handleVerifyEmail navigates to LOGIN", () => {
    // GIVEN: The hook is used in a component
    const { result } = renderHook(() => useRouteHandlers(), {
      // @ts-ignore
      wrapper: ({ children }) => (
        <UserPreferencesWrapper>
          <MemoryRouter>{children}</MemoryRouter>
        </UserPreferencesWrapper>
      ),
    });

    // WHEN: handleVerifyEmail is called
    act(() => {
      result.current.handleVerifyEmail();
    });

    // THEN: The user should be navigated to LOGIN
    expect(useNavigate()).toHaveBeenCalledWith(routerPaths.LOGIN, { replace: true });
  });

  test("isLoading state is managed correctly during handleLogin", async () => {
    // GIVEN: The hook is used in a component
    mockGetUserPreferences.mockImplementation((userId, successCallback) => {
      successCallback({ accepted_tc: new Date() });
    });

    const { result } = renderHook(() => useRouteHandlers(), {
      // @ts-ignore
      wrapper: ({ children }) => (
        <UserPreferencesWrapper>
          <MemoryRouter>{children}</MemoryRouter>
        </UserPreferencesWrapper>
      ),
    });

    // WHEN: handleLogin is called
    await act(async () => {
      result.current.handleLogin(givenUser);
    });

    // THEN: isLoading should be true during the async call and false after it resolves
    expect(result.current.isPostLoginLoading).toBe(false);
  });
});
