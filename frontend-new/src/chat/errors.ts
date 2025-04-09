/**
 * Custom error classes for the chat application.
 */

export class InvalidConversationPhasePercentage extends Error {
  /**
   * Constructor for InvalidConversationPhasePercentage error.
   *
   * @param percentage - the percentage that caused the error
   * @param reason - the reason the percentage is invalid.
   */
  constructor(percentage: number, reason: string) {
    super(`Invalid conversation phase percentage: ${percentage}. Reason: ${reason}`);
    this.name = "InvalidConversationPhasePercentage";
  }
}
