jest.mock("src/envService", () => ({
  getFirebaseAPIKey: jest.fn(() => "mock-api-key"),
  getFirebaseDomain: jest.fn(() => "mock-auth-domain"),
  getBackendUrl: jest.fn(() => "mock-backend-url"),
  getApplicationLoginCode: jest.fn(() => ""),
  getApplicationRegistrationCode: jest.fn(() => ""),
  getMetricsEnabled: jest.fn(() => "true"),
}));
