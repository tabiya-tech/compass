// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, within } from "@testing-library/react";

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
  return {
    __esModule: true,
    ThemeProvider: mThemeProvider,
    CssBaseline: mCssBaseline,
  };
});

// mock AuthProvider
jest.mock("./auth/AuthProvider/AuthProvider", () => {
  const mAuthProvider = jest
    .fn()
    .mockImplementation(({ children }) => <div data-testid="auth-provider-id">{children}</div>);
  return {
    __esModule: true,
    AuthProvider: mAuthProvider,
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

// mock the UserPreferencesProvider
jest.mock("./userPreferences/UserPreferencesProvider/UserPreferencesProvider", () => {
  const mUserPreferencesProvider = jest.fn().mockImplementation(({ children }) => children);
  return {
    __esModule: true,
    UserPreferencesProvider: mUserPreferencesProvider,
  };
});

// mock the invitationsProvider
jest.mock("./invitations/InvitationsProvider/InvitationsProvider", () => {
  const mInvitationsProvider = jest.fn().mockImplementation(({ children }) => children);
  return {
    __esModule: true,
    InvitationsProvider: mInvitationsProvider,
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

// mock the hash router
jest.mock("react-router-dom", () => {
  const mHashRouter = jest.fn().mockImplementation(({ children }) => children);
  return {
    __esModule: true,
    HashRouter: mHashRouter,
  };
});

describe("test the application bootstrapping", () => {
  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
  });

  test("should render the app", () => {
    jest.isolateModules(() => {
      // WHEN the main index module is imported
      require("./index");

      // THEN expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      // AND expect the theme provider to be in the DOM
      const themeProviderElement = screen.getByTestId("theme-provider-id");
      expect(themeProviderElement).toBeInTheDocument();

      // AND expect the css baseline to be in the DOM
      const cssBaselineElement = screen.getByTestId("css-baseline-id");
      expect(cssBaselineElement).toBeInTheDocument();

      // AND expect the auth provider to be in the DOM and to be a child of the theme provider
      const authProviderElement = within(themeProviderElement).getByTestId("auth-provider-id");
      expect(authProviderElement).toBeInTheDocument();

      // AND expect the snackbar provider to be in the DOM and to be a child of the theme provider
      const snackbarProviderElement = within(themeProviderElement).getByTestId("snackbar-provider-id");
      expect(snackbarProviderElement).toBeInTheDocument();

      // AND expect the compass app to be in the DOM and to be a child of the theme provider
      const compassAppElement = within(themeProviderElement).getByTestId("compass-app-id");
      expect(compassAppElement).toBeInTheDocument();
    });
  });
});
