// mute the console
import "src/_test_utilities/consoleMock";

import App from "./index";
import { render, screen } from "@testing-library/react";
import { Route } from "react-router-dom";
import routerConfig from "./routerConfig";

// mock the react-router-dom
jest.mock("react-router-dom", () => {
  return {
    __esModule: true,
    HashRouter: jest.fn().mockImplementation(({ children }) => <div data-testid="hash-router-id">{children}</div>),
    Route: jest.fn().mockImplementation(({ children }) => <div data-testid="route-id">{children}</div>),
    Routes: jest.fn().mockImplementation(({ children }) => <div data-testid="routes-id">{children}</div>),
  };
});

// mock the auth provider
jest.mock("src/auth/AuthProvider", () => {
  return {
    __esModule: true,
    AuthProvider: jest.fn().mockImplementation(({ children }) => <div data-testid="auth-provider-id">{children}</div>),
  };
});

describe("main compass app test", () => {
  test("should render app successfully", () => {
    // WHEN the app is rendered
    render(<App />);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the HASH ROUTER to be in the document
    const router = screen.getByTestId("hash-router-id");
    expect(router).toBeInTheDocument();
    // AND the auth provider to be in the document
    const authProvider = screen.getByTestId("auth-provider-id");
    expect(authProvider).toBeInTheDocument();
    // AND for each path to have a route configured
    const allRoutes = screen.queryAllByTestId("route-id");
    expect(allRoutes.length).toBe(routerConfig.length);
    // AND The routes to be configured with the router config
    routerConfig.forEach((cfg) => {
      expect(Route).toHaveBeenCalledWith(cfg, {});
    });
  });
});
