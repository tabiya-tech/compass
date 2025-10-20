// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, within } from "@testing-library/react";
import { MAX_WAIT_TIME_FOR_ROOT_ELEMENT, ROOT_ELEMENT_POLL_INTERVAL } from "./index";





// mock the react-dom/client
// Using jest.doMock() so that the render function can be accessed from within the mock
jest.doMock("react-dom/client", () => {
  const ReactDOMMock = {
    createRoot: jest.fn().mockImplementation(() => {
      return {
        render: jest.fn().mockImplementation((component) => {
          render(component);
        }),
        unmount: jest.fn(),
      };
    }),
  };
  return {
    __esModule: true,
    default: ReactDOMMock,
  };
});

// mock CompassApp
jest.mock("./app", () => {
  const mCompassApp = () => (
    <div id="compass-app-id" data-testid="compass-app-id">
      Mock CompassApp
    </div>
  );
  return {
    __esModule: true,
    default: mCompassApp,
  };
});

// mock Material UI ThemeProvider
jest.mock("@mui/material", () => {
  const mThemeProvider = jest
    .fn()
    .mockImplementation(({ children }) => <div data-testid="theme-provider-id">{children}</div>);
  const mCssBaseline = () => <div data-testid="css-baseline-id">Mock CssBaseline</div>;
  const actual = jest.requireActual("@mui/material");
  return {
    __esModule: true,
    ...actual,
    ThemeProvider: mThemeProvider,
    CssBaseline: mCssBaseline,
  };
});

// mock SnackbarProvider
jest.mock("./theme/SnackbarProvider/SnackbarProvider", () => {
  const mSnackbarProvider = jest
    .fn()
    .mockImplementation(({ children }) => <div data-testid="snackbar-provider-id">{children}</div>);
  return {
    __esModule: true,
    default: mSnackbarProvider,
  };
});

// mock the ViewPortWrapper
jest.mock("src/app/ViewPortWrapper", () => {
  const mViewPortWrapper = jest.fn().mockImplementation(({ children }) => children);
  return {
    __esModule: true,
    default: mViewPortWrapper,
  };
});

// mock the IsOnlineProvider
jest.mock("src/app/isOnlineProvider/IsOnlineProvider", () => {
  const mIsOnlineProvider = jest.fn().mockImplementation(({ children }) => children);
  return {
    __esModule: true,
    IsOnlineProvider: mIsOnlineProvider,
  };
});

// mock the sentry init
jest.mock("./sentryInit", () => {
  return {
    __esModule: true,
    initSentry: jest.fn(),
  };
});

// mock i18next
jest.mock("i18next", () => ({
  use: jest.fn().mockReturnThis(),
  init: jest.fn().mockReturnThis(),
  changeLanguage: jest.fn().mockResolvedValue("en-gb"),
}));

describe("test the application bootstrapping", () => {
  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.useFakeTimers();

    // Clear the entire document body
    document.body.innerHTML = "";

    // Reset modules
    jest.resetModules();
  });

  afterEach(() => {
    jest.useRealTimers();
    // Clean up the DOM
    document.body.innerHTML = "";
  });

  test("should render the app when root element is immediately available", async () => {

    // GIVEN the root element exists in the DOM
    const mockRootElement = document.createElement("div");
    mockRootElement.id = "root";
    document.body.appendChild(mockRootElement);

    // WHEN the main index module is imported
    let ensureRequiredEnvVarsMock: jest.SpyInstance = jest.fn();
    jest.isolateModules(async () => {
      ensureRequiredEnvVarsMock = jest
        .spyOn(require("src/envService"), "ensureRequiredEnvVars")
        .mockImplementation(jest.fn);
      require("./index");
    });

    // AND we run all timers to ensure all async operations complete
    jest.runAllTimers();

    // AND we wait for any pending promises
    await Promise.resolve();
    await Promise.resolve(); // Double flush to ensure all microtasks complete

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND expect the theme provider to be in the DOM
    const themeProviderElement = screen.getByTestId("theme-provider-id");
    expect(themeProviderElement).toBeInTheDocument();

    // AND expect the css baseline to be in the DOM
    const cssBaselineElement = screen.getByTestId("css-baseline-id");
    expect(cssBaselineElement).toBeInTheDocument();

    // AND expect the snackbar provider to be in the DOM and to be a child of the theme provider
    const snackbarProviderElement = within(themeProviderElement).getByTestId("snackbar-provider-id");
    expect(snackbarProviderElement).toBeInTheDocument();

    // AND expect the compass app to be in the DOM and to be a child of the theme provider
    const compassAppElement = within(themeProviderElement).getByTestId("compass-app-id");
    expect(compassAppElement).toBeInTheDocument();

    // AND expect the ensureRequiredEnvVars function to have been called
    expect(ensureRequiredEnvVarsMock).toHaveBeenCalled();
    // AND expect the compass app to match the snapshot
    expect(compassAppElement).toMatchSnapshot();
  });

  test("should render the app after waiting for root element", async () => {
    // GIVEN the root element doesn't exist initially
    const mockRootElement = document.createElement("div");
    mockRootElement.id = "root";
    // ADN the loading screen is shown and visible
    const loadingScreen = document.createElement("div");
    loadingScreen.id = "loading";
    loadingScreen.style.opacity = "1";
    document.body.appendChild(loadingScreen);
    // guard to ensure the loading screen is  visible
    expect(loadingScreen).toBeVisible();


    // WHEN the main index module is imported
    let ensureRequiredEnvVarsMock: jest.SpyInstance = jest.fn();
    jest.isolateModules(async () => {
      ensureRequiredEnvVarsMock = jest
        .spyOn(require("src/envService"), "ensureRequiredEnvVars")
        .mockImplementation(jest.fn);
      require("./index");
    });

    // AND we advance time by one polling interval
    jest.advanceTimersByTime(ROOT_ELEMENT_POLL_INTERVAL);

    // AND we add the root element to the DOM
    document.body.appendChild(mockRootElement);

    // AND we advance time by another polling interval to trigger the next check
    jest.advanceTimersByTime(ROOT_ELEMENT_POLL_INTERVAL);

    // AND we run all remaining timers to ensure all async operations complete
    jest.runAllTimers();

    // AND we wait for any pending promises
    await Promise.resolve();
    await Promise.resolve(); // Double flush to ensure all microtasks complete

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();

    // AND expect the loading screen to be hidden
    expect(loadingScreen).not.toBeVisible();

    // AND expect the theme provider to be in the DOM
    const themeProviderElement = screen.getByTestId("theme-provider-id");
    expect(themeProviderElement).toBeInTheDocument();

    // AND expect the css baseline to be in the DOM
    const cssBaselineElement = screen.getByTestId("css-baseline-id");
    expect(cssBaselineElement).toBeInTheDocument();

    // AND expect the snackbar provider to be in the DOM and to be a child of the theme provider
    const snackbarProviderElement = within(themeProviderElement).getByTestId("snackbar-provider-id");
    expect(snackbarProviderElement).toBeInTheDocument();

    // AND expect the compass app to be in the DOM and to be a child of the theme provider
    const compassAppElement = within(themeProviderElement).getByTestId("compass-app-id");
    expect(compassAppElement).toBeInTheDocument();

    // AND expect the ensureRequiredEnvVars function to have been called
    expect(ensureRequiredEnvVarsMock).toHaveBeenCalled();
  });

  test("should log error when root element is not found after maximum attempts", async () => {
    // WHEN the main index module is imported
    jest.isolateModules(async () => {
      jest
        .spyOn(require("src/envService"), "ensureRequiredEnvVars")
        .mockImplementation(jest.fn);
      require("./index");
    });

    // AND we advance time by the maximum wait time
    jest.advanceTimersByTime(MAX_WAIT_TIME_FOR_ROOT_ELEMENT);

    // AND we run all remaining timers to ensure all async operations complete
    jest.runAllTimers();

    // AND we wait for any pending promises
    await Promise.resolve();
    await Promise.resolve(); // Double flush to ensure all microtasks complete

    // THEN expect an error to be logged
    expect(console.error).toHaveBeenCalledWith(
      "Failed to initialize React:",
      expect.any(Error),
    );

    // AND expect the error message to indicate maximum attempts were reached
    const errorCall = (console.error as jest.Mock).mock.calls[0];
    expect(errorCall[1].message).toBe(
      "Root element not found after maximum attempts",
    );

    // AND expect no app to be rendered
    expect(screen.queryByTestId("theme-provider-id")).not.toBeInTheDocument();
  });
});
