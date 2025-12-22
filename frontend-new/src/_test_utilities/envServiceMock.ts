jest.mock("src/envService", () => ({
  getFirebaseAPIKey: jest.fn(() => "mock-api-key"),
  getFirebaseDomain: jest.fn(() => "mock-auth-domain"),
  getBackendUrl: jest.fn(() => "mock-backend-url"),
  getApplicationLoginCode: jest.fn(() => ""),
  getApplicationRegistrationCode: jest.fn(() => ""),
  getLoginCodeDisabled: jest.fn(() => "false"),
  getRegistrationDisabled: jest.fn(() => "false"),
  getMetricsEnabled: jest.fn(() => "true"),
  getMetricsConfig: jest.fn(() => ""),
  getCvUploadEnabled: jest.fn(() => "true"),
  getSocialAuthDisabled: jest.fn(() => "false"),
  getSupportedLocales: jest.fn(() => JSON.stringify([])),
  getDefaultLocale: jest.fn(() => "en-US")
}));
