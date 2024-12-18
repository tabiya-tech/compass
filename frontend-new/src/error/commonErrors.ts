enum CommonError {
  TOKEN_ERROR = "TokenError",
  AUTHENTICATION_ERROR = "AuthenticationError",
  SESSION_ERROR = "SessionError",
  CHAT_ERROR = "ChatError",
  FEEDBACK_ERROR = "FeedbackError",
  ENV_ERROR = "EnvError",
  COMPONENT_ERROR = "ComponentError",
}

/**
 * Used for errors related to token generation, decoding and verification
 * */
export class TokenError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = CommonError.TOKEN_ERROR;
    this.cause = cause;
  }
}

export class AuthenticationError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = CommonError.AUTHENTICATION_ERROR;
    this.cause = cause;
  }
}

export class SessionError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = CommonError.SESSION_ERROR;
    this.cause = cause;
  }
}

export class ChatError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = CommonError.CHAT_ERROR;
    this.cause = cause;
  }
}

export class FeedbackError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = CommonError.FEEDBACK_ERROR;
    this.cause = cause;
  }
}

export class EnvError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = CommonError.ENV_ERROR;
    this.cause = cause;
  }
}

export class ComponentError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = CommonError.COMPONENT_ERROR;
    this.cause = cause;
  }
}
