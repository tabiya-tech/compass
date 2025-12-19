import { ReactionError } from "src/error/commonErrors";

export enum ReactionKind {
  LIKED = "LIKED",
  DISLIKED = "DISLIKED",
}

export enum DislikeReason {
  INAPPROPRIATE_TONE = "INAPPROPRIATE_TONE",
  OFFENSIVE_LANGUAGE = "OFFENSIVE_LANGUAGE",
  BIASED = "BIASED",
  INCORRECT_INFORMATION = "INCORRECT_INFORMATION",
  IRRELEVANT = "IRRELEVANT",
  CONFUSING = "CONFUSING",
}


export const DislikeReasonTranslationKey = {
  [DislikeReason.INAPPROPRIATE_TONE]: "chat.reaction.components.dislikeReasonPopover.reasons.inappropriateTone",
  [DislikeReason.OFFENSIVE_LANGUAGE]: "chat.reaction.components.dislikeReasonPopover.reasons.offensiveLanguage",
  [DislikeReason.BIASED]: "chat.reaction.components.dislikeReasonPopover.reasons.biased",
  [DislikeReason.INCORRECT_INFORMATION]: "chat.reaction.components.dislikeReasonPopover.reasons.incorrectInformation",
  [DislikeReason.IRRELEVANT]: "chat.reaction.components.dislikeReasonPopover.reasons.irrelevant",
  [DislikeReason.CONFUSING]: "chat.reaction.components.dislikeReasonPopover.reasons.confusing",
} as const;

export const DislikeReasonMessages = {
  [DislikeReason.INAPPROPRIATE_TONE]: "Inappropriate Tone",
  [DislikeReason.OFFENSIVE_LANGUAGE]: "Offensive Language",
  [DislikeReason.BIASED]: "Biased",
  [DislikeReason.INCORRECT_INFORMATION]: "Incorrect Information",
  [DislikeReason.IRRELEVANT]: "Irrelevant",
  [DislikeReason.CONFUSING]: "Confusing",
};

// Base abstract class for reactions
export abstract class BaseReaction {
  abstract readonly kind: ReactionKind;
}

// Like reaction class - no additional properties needed
export class LikeReaction extends BaseReaction {
  readonly kind = ReactionKind.LIKED;
  readonly reasons: DislikeReason[] = [];

  constructor() {
    super();
    if(this.reasons.length > 0){
      throw new ReactionError("Like Reactions should not have any reasons");
    }
  }
}

// Dislike reaction class - includes reasons
export class DislikeReaction extends BaseReaction {
  readonly kind = ReactionKind.DISLIKED;
  
  constructor(public readonly reasons: DislikeReason[]) {
    super();
    if(reasons.length === 0){
      throw new ReactionError("Dislike Reactions should always have a reason");
    }
  }
}