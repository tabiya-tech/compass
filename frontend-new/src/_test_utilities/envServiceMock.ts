jest.mock("src/envService", () => ({
  getFirebaseAPIKey: jest.fn(() => "mock-api-key"),
  getFirebaseDomain: jest.fn(() => "mock-auth-domain"),
  getBackendUrl: jest.fn(() => "mock-backend-url"),
  getApplicationLoginCode: jest.fn(() => ""),
  getApplicationRegistrationCode: jest.fn(() => ""),
  getApplicationLoginCodeDisabled: jest.fn(() => "false"),
  getMetricsEnabled: jest.fn(() => "true"),
  getCvUploadEnabled: jest.fn(() => "true"),
}));
