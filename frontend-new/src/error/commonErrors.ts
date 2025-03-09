enum CommonError {
  TOKEN_ERROR = "TokenError",
  AUTHENTICATION_ERROR = "AuthenticationError",
  USER_PREFERENCE_ERROR = "UserPreferenceError",
  INVITATION_ERROR = "InvitationError",
  SESSION_ERROR = "SessionError",
  CHAT_ERROR = "ChatError",
  REACTION_ERROR = "ReactionError",
  FEEDBACK_ERROR = "FeedbackError",
  ENV_ERROR = "EnvError",
  COMPONENT_ERROR = "ComponentError",
  CONFIGURATION_ERROR = "ConfigurationError",
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

export class UserPreferenceError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = CommonError.USER_PREFERENCE_ERROR;
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

export class ReactionError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = CommonError.REACTION_ERROR;
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

export class InvitationError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = CommonError.INVITATION_ERROR;
    this.cause = cause;
  }
}

export class ConfigurationError extends Error {
  constructor(message: string, cause?: Error | string) {
    super(message);
    this.name = CommonError.CONFIGURATION_ERROR;
    this.cause = cause;
  }
}
