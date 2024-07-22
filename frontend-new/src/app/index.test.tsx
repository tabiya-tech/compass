// mute the console
import "src/_test_utilities/consoleMock";

import App, { SNACKBAR_KEYS } from "./index";
import { render, screen } from "src/_test_utilities/test-utils";
import { Route } from "react-router-dom";
import routerConfig from "./routerConfig";
import { unmockBrowserIsOnLine, mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { DEFAULT_SNACKBAR_AUTO_HIDE_DURATION, useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";

// mock the snackbar
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      DEFAULT_SNACKBAR_AUTO_HIDE_DURATION: actual.DEFAULT_SNACKBAR_AUTO_HIDE_DURATION,
      enqueueSnackbar: jest.fn(),
      closeSnackbar: jest.fn(),
    }),
  };
});

// mock the react-router-dom
jest.mock("react-router-dom", () => {
  return {
    __esModule: true,
    HashRouter: jest.fn().mockImplementation(({ children }) => <div data-testid="hash-router-id">{children}</div>),
    Route: jest.fn().mockImplementation(({ children }) => <div data-testid="route-id">{children}</div>),
    Routes: jest.fn().mockImplementation(({ children }) => <div data-testid="routes-id">{children}</div>),
    NavLink: jest.fn().mockImplementation(({ children }) => <div data-testid="nav-link-id">{children}</div>),
  };
});

describe("main compass app test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    unmockBrowserIsOnLine();
  });
  
  test("should render app successfully", () => {
    // WHEN the app is rendered
    render(<App />);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the HASH ROUTER to be in the document
    const router = screen.getByTestId("hash-router-id");
    expect(router).toBeInTheDocument();
    // AND for each path to have a route configured
    const allRoutes = screen.queryAllByTestId("route-id");
    expect(allRoutes.length).toBe(routerConfig.length);
    // AND The routes to be configured with the router config
    routerConfig.forEach((cfg) => {
      expect(Route).toHaveBeenCalledWith(cfg, {});
    });
  });

  describe("when the app is offline/online", () => {
    const expectedOfflineSnackBar = {
      variant: "warning",
      key: SNACKBAR_KEYS.OFFLINE_ERROR,
      preventDuplicate: true,
      persist: true,
      action: [],
    };
    const expectedOnlineSnackBar = {
      variant: "success",
      key: SNACKBAR_KEYS.ONLINE_SUCCESS,
      preventDuplicate: true,
      autoHideDuration: DEFAULT_SNACKBAR_AUTO_HIDE_DURATION,
    };
    const expectedMessageOffline = `You are offline`;
    const expectedMessageOnline = `You are back online`;

    test("should show the online then offline notification when the browser switches from offline->online->offline", async () => {
      // GIVEN that the app is initially rendered while the browser is offline
      mockBrowserIsOnLine(false);
      render(<App />);

      // THEN expect the offline notification to be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expectedMessageOffline, expectedOfflineSnackBar);

      // AND WHEN the browser goes online
      mockBrowserIsOnLine(true);

      // THEN expect the offline notification to disappear
      expect(useSnackbar().closeSnackbar).toHaveBeenCalledWith(SNACKBAR_KEYS.OFFLINE_ERROR);
      // AND the online notification to be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expectedMessageOnline, expectedOnlineSnackBar);

      // AND WHEN the browser goes offline again
      mockBrowserIsOnLine(false);
      // THEN  the online notification to be shown
      expect(useSnackbar().closeSnackbar).toHaveBeenCalledWith(SNACKBAR_KEYS.ONLINE_SUCCESS);
      // AND the online notification to be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expectedMessageOffline, expectedOfflineSnackBar);
    });

    test("should show the offline notification when the app renders for the first time and the browser is offline", async () => {
      // GIVEN the browser is offline
      mockBrowserIsOnLine(false);

      // WHEN the app is rendered
      render(<App />);

      // THEN the offline warning should be shown
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith(expectedMessageOffline, expectedOfflineSnackBar);
    });

    test("should not show the online notification when the app renders for the first time and the browser is online", async () => {
      // GIVEN that the browser is online
      mockBrowserIsOnLine(true);

      // WHEN the app is rendered
      render(<App />);

      // THEN expect the offline and online notification to not be shown
      expect(useSnackbar().enqueueSnackbar).not.toHaveBeenCalled();
    });
  });
});
