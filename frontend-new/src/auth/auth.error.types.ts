/**
 * Used for errors related to token generation, decoding and verification
 * */
export class TokenError extends Error {
  constructor(message: string, cause: Error | string) {
    super(message);
    this.name = TokenError.name;
    this.cause = cause;
  }
}