enum AuthError {
  TOKEN_ERROR = 'TokenError',
}

/**
 * Used for errors related to token generation, decoding and verification
 * */
export class TokenError extends Error {
  constructor(message: string, cause: Error | string) {
    super(message);
    this.name = AuthError.TOKEN_ERROR;
    this.cause = cause;
  }
}