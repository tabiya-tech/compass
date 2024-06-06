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
jest.mock("./App", () => {
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

      // AND expect the compass app to be in the DOM and to be a child of the theme provider
      const compassAppElement = within(themeProviderElement).getByTestId("compass-app-id");
      expect(compassAppElement).toBeInTheDocument();
    });
  });
});
