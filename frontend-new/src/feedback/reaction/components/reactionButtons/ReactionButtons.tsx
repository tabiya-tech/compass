import React, { useState, useContext } from "react";
import { Box, useTheme } from "@mui/material";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { ReactionReason, ReactionType } from "src/feedback/reaction/reaction.types";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
import ThumbDownAltIcon from "@mui/icons-material/ThumbDownAlt";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import ThumbDownOffAltIcon from "@mui/icons-material/ThumbDownOffAlt";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import ReactionReasonPopover from "src/feedback/reaction/components/reactionReasonPopover/ReactionReasonPopover";
import ReactionService from "src/feedback/reaction/services/reactionService/reaction.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { ReactionError } from "src/error/commonErrors";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";

interface ReactionButtonsProps {
  messageId: string;
  currentReaction: ReactionType | null;
  onReactionChange: (messageId: string, reaction: ReactionType | null, reason?: string) => void;
}

const uniqueId = "8d4e6f2c-9a3b-4c5d-b1e7-5f9d8a2b3c4e";

export const DATA_TEST_ID = {
  CONTAINER: `reaction-buttons-container-${uniqueId}`,
  BUTTON_LIKE: `reaction-button-like-${uniqueId}`,
  BUTTON_DISLIKE: `reaction-button-dislike-${uniqueId}`,
  ICON_LIKE_DEFAULT: `reaction-icon-like-default-${uniqueId}`,
  ICON_LIKE_ACTIVE: `reaction-icon-like-active-${uniqueId}`,
  ICON_DISLIKE_DEFAULT: `reaction-icon-dislike-default-${uniqueId}`,
  ICON_DISLIKE_ACTIVE: `reaction-icon-dislike-active-${uniqueId}`,
};

export const ReactionButtons: React.FC<ReactionButtonsProps> = ({
  messageId,
  currentReaction,
  onReactionChange
}) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const isOnline = useContext(IsOnlineContext);

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [reaction, setReaction] = useState<ReactionType | null>(currentReaction);
  const [previousReaction, setPreviousReaction] = useState<ReactionType | null>(currentReaction);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSessionId] = useState<number | null>(
    UserPreferencesStateService.getInstance().getActiveSessionId()
  );
  const reactionService = new ReactionService();

  // Close the popover
  const handlePopoverClose = () => {
    setIsPopoverOpen(false);
    setAnchorEl(null);
  };

  const handleLikeClick = async () => {
    if(!activeSessionId){
      throw new ReactionError("Session id is not available")
    }

    // If the user is submitting a request, do nothing
    if (isSubmitting) {
      enqueueSnackbar("Please wait, your request is being processed.", { variant: "warning" });
      return;
    }

    setIsSubmitting(true);
    setPreviousReaction(reaction); // Save the previous reaction in case of failure

    // If the current reaction is "like," deactivate it
    if (reaction === ReactionType.LIKE) {
      try {
        setReaction(null); // clear the reaction
        await reactionService.deleteReaction(activeSessionId, messageId);
        onReactionChange(messageId, null);
      } catch (error) {
        console.error(new Error("Failed to remove the like feedback", { cause: error }));
        enqueueSnackbar("Failed to remove the feedback. Please try again.", { variant: "error" });
        setReaction(ReactionType.LIKE); // Rollback in case of failure
        onReactionChange(messageId, ReactionType.LIKE);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Otherwise, add a "like" reaction
    setReaction(ReactionType.LIKE);
    try {
      await reactionService.sendReaction(activeSessionId, messageId, { kind: ReactionType.LIKE });
      onReactionChange(messageId, ReactionType.LIKE);
    } catch (error) {
      setReaction(previousReaction);
      onReactionChange(messageId, previousReaction);
      console.error(new Error("Failed to submit the like feedback", { cause: error }));
      enqueueSnackbar("Failed to submit the feedback. Please try again.", { variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDislikeClick = async (event: React.MouseEvent<HTMLElement>) => {
    if(!activeSessionId){
      throw new ReactionError("Session id is not available")
    }

    // If the user is submitting a request, do nothing
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setPreviousReaction(reaction); // Save the previous reaction in case of failure

    // If the current reaction is "dislike," deactivate it
    if (reaction === ReactionType.DISLIKE) {
      try {
        setReaction(null); // clear the reaction
        await reactionService.deleteReaction(activeSessionId, messageId);
        onReactionChange(messageId, null);
      } catch (error) {
        console.error(new Error("Failed to remove the dislike feedback", { cause: error }));
        enqueueSnackbar("Failed to remove the feedback. Please try again.", { variant: "error" });
        setReaction(ReactionType.DISLIKE); // Rollback in case of failure
        onReactionChange(messageId, ReactionType.DISLIKE);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // If the user clicked dislike but has not yet disliked, show popover
    setAnchorEl(event.currentTarget);
    setIsPopoverOpen(true);
  };

  const handleReasonSelect = async (reason: ReactionReason) => {
    if(!activeSessionId){
      throw new ReactionError("Session id is not available")
    }

    setIsSubmitting(true);
    setPreviousReaction(reaction); // Save the previous reaction in case of failure
    setReaction(ReactionType.DISLIKE); // Set the reaction
    handlePopoverClose();

    try {
      await reactionService.sendReaction(activeSessionId, messageId, {
        kind: ReactionType.DISLIKE,
        reason: reason,
      });
      onReactionChange(messageId, ReactionType.DISLIKE);
    } catch (error) {
      setReaction(previousReaction); // Rollback in case of failure
      onReactionChange(messageId, previousReaction);
      console.error(new Error("Failed to submit the dislike feedback", { cause: error }));
      enqueueSnackbar("Failed to submit the feedback. Please try again.", { variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Box display="flex" gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)} data-testid={DATA_TEST_ID.CONTAINER}>
        <PrimaryIconButton
          sx={{
            color: theme.palette.common.black,
          }}
          onClick={handleLikeClick}
          data-testid={DATA_TEST_ID.BUTTON_LIKE}
          title="like"
          disabled={!isOnline}
        >
          {reaction === ReactionType.LIKE ? (
            <ThumbUpAltIcon data-testid={DATA_TEST_ID.ICON_LIKE_ACTIVE} sx={{ color: theme.palette.text.secondary }} />
          ) : (
            <ThumbUpOffAltIcon data-testid={DATA_TEST_ID.ICON_LIKE_DEFAULT} />
          )}
        </PrimaryIconButton>

        <PrimaryIconButton
          sx={{
            color: theme.palette.common.black,
          }}
          onClick={handleDislikeClick}
          data-testid={DATA_TEST_ID.BUTTON_DISLIKE}
          title="dislike"
          disabled={!isOnline}
        >
          {reaction === ReactionType.DISLIKE ? (
            <ThumbDownAltIcon
              data-testid={DATA_TEST_ID.ICON_DISLIKE_ACTIVE}
              sx={{ color: theme.palette.text.secondary }}
            />
          ) : (
            <ThumbDownOffAltIcon data-testid={DATA_TEST_ID.ICON_DISLIKE_DEFAULT} />
          )}
        </PrimaryIconButton>
      </Box>
      <ReactionReasonPopover
        anchorEl={anchorEl}
        open={isPopoverOpen}
        onClose={handlePopoverClose}
        onReasonSelect={handleReasonSelect}
      />
    </>
  );
};

export default ReactionButtons;
