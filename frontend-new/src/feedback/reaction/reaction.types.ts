export enum ReactionType {
  LIKE = "like",
  DISLIKE = "dislike",
}

export enum ReactionReason {
  OFFENSIVE = "offensive",
  BIASED = "biased",
  INCORRECT = "incorrect",
  WRONG_PHRASE = "wrong_phrasing",
  WRONG_LANGUAGE = "wrong_language",
}

export const ReactReasonMessages = {
  [ReactionReason.OFFENSIVE]: "Offensive",
  [ReactionReason.BIASED]: "Biased",
  [ReactionReason.INCORRECT]: "Incorrect",
  [ReactionReason.WRONG_PHRASE]: "Wrong Phrasing",
  [ReactionReason.WRONG_LANGUAGE]: "Wrong Language",
};

export class Reaction {
  constructor(
    public kind: ReactionType,
    public reason?: ReactionReason
  ) {
    if (kind === ReactionType.LIKE && reason) {
      throw new Error("Like reactions cannot have a reason");
    }
    if (kind === ReactionType.DISLIKE && !reason) {
      throw new Error("Dislike reactions must have a reason");
    }
  }
}
