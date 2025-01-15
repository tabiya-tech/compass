export enum ReactionType {
  LIKED = "liked",
  DISLIKED = "disliked",
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
    public reason: ReactionReason | null
  ) {
    if (kind === ReactionType.LIKED && reason) {
      throw new Error("Like reactions cannot have a reason");
    }
    if (kind === ReactionType.DISLIKED && !reason) {
      throw new Error("Dislike reactions must have a reason");
    }
  }
}
