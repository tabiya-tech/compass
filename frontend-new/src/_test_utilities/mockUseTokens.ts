export function mockUseTokens(overrides = {}) {
  jest.spyOn(require("src/auth/hooks/useTokens"), "useTokens").mockImplementation(() => {
    return {
      isAuthenticating: false,
      isAuthenticated: true,
      setIsAuthenticated: jest.fn(),
      setAccessToken: jest.fn(),
      clearTokens: jest.fn(),
      ...overrides,
    };
  });
}
