/**
 * Mocks the sentry module
 * Import this module in your test file to mock the sentry module
 */
jest.mock("@sentry/react", () => ({
  withSentry: (Component: any) => Component,
  getFeedback: jest.fn(),
  captureFeedback: jest.fn(),
  withProfiler: (Component: any) => Component,
  wrapCreateBrowserRouterV6: (Component: any) => Component,
  isInitialized: jest.fn(),
}));
