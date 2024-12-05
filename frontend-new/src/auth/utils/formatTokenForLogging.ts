export const formatTokenForLogging = (token: string): string => {
  if (!token) {
    return "<no token>";
  }

  if (token.trim() === "") {
    return "<empty token>";
  }

  if (token.trim().length === token.length && token.trim() === "") {
    return "<whitespace token>";
  }

  if (token.length <= 12) {
    return token;
  }

  const firstSix = token.slice(0, 6);
  const lastSix = token.slice(-6);
  return `${firstSix}...${lastSix}`;
};
