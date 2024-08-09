export function mockUseTokens(overrides = {}) {
  jest.spyOn(require("src/auth/hooks/useTokens"), "useTokens").mockImplementation(() => {
    return {
      setIsAuthenticated: jest.fn(),
      setToken: jest.fn(),
      getToken: jest.fn(),
      clearTokens: jest.fn(),
      ...overrides,
    };
  });
}
