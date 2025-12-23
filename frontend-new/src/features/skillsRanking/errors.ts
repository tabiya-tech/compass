export class SkillsRankingError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SkillsRankingError";
    this.cause = cause;
  }
}
