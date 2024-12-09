enum AuthError {
  TOKEN_ERROR = 'TokenError',
  AUTHENTICATION_ERROR = 'AuthenticationError',
  SESSION_ERROR = 'SessionError',
  CHAT_ERROR = 'ChatError',
  FEEDBACK_ERROR = 'FeedbackError',
}

/**
 * Used for errors related to token generation, decoding and verification
 * */
export class TokenError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = AuthError.TOKEN_ERROR;
    this.cause = cause;
  }
}

export class AuthenticationError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = AuthError.AUTHENTICATION_ERROR;
    this.cause = cause;
  }
}

export class SessionError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = AuthError.SESSION_ERROR;
    this.cause = cause;
  }
}

export class ChatError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = AuthError.CHAT_ERROR;
    this.cause = cause;
  }
}

export class FeedbackError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = AuthError.FEEDBACK_ERROR;
    this.cause = cause;
  }
}