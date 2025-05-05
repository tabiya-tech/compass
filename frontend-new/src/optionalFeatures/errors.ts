export class InvalidFeaturesConfig extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "InvalidFeaturesConfig";
    this.cause = cause;
  }
}
