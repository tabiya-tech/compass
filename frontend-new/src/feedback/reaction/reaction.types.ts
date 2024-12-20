export enum ReactionType {
  LIKE = "like",
  DISLIKE = "dislike",
}

export enum ReactionReason {
  OFFENSIVE = "Offensive",
  BIASED = "Biased",
  INCORRECT = "Incorrect",
  WRONG_PHRASE = "Wrong phrasing",
  WRONG_LANGUAGE = "Wrong language",
}

export class Reaction {
  constructor(
    public kind: ReactionType,
    public reason?: ReactionReason,
  ) {
    if (kind === ReactionType.LIKE && reason) {
      throw new Error('Like reactions cannot have a reason');
    }
    if (kind === ReactionType.DISLIKE && !reason) {
      throw new Error('Dislike reactions must have a reason');
    }
  }
}