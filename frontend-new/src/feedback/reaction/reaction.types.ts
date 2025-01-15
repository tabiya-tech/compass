export enum ReactionType {
  LIKED = "liked",
  DISLIKED = "disliked",
}

export enum ReactionReason {
  INAPPROPRIATE_TONE = "inappropriate-tone",
  OFFENSIVE_LANGUAGE = "offensive-language",
  BIASED = "biased",
  INCORRECT_INFORMATION = "incorrect-information",
  IRRELEVANT = "irrelevant",
  CONFUSING = "confusing",
}

export const ReactReasonMessages = {
  [ReactionReason.INAPPROPRIATE_TONE]: "Inappropriate Tone",
  [ReactionReason.OFFENSIVE_LANGUAGE]: "Offensive Language",
  [ReactionReason.BIASED]: "Biased",
  [ReactionReason.INCORRECT_INFORMATION]: "Incorrect Information",
  [ReactionReason.IRRELEVANT]: "Irrelevant",
  [ReactionReason.CONFUSING]: "Confusing",
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
