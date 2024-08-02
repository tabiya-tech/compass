export function mockUseTokens(overrides = {}) {
  jest.spyOn(require("src/auth/hooks/useTokens"), "useTokens").mockImplementation(() => {
    return {
      isAuthenticating: false,
      isAuthenticated: true,
      setIsAuthenticated: jest.fn(),
      setToken: jest.fn(),
      clearTokens: jest.fn(),
      ...overrides,
    };
  });
}
