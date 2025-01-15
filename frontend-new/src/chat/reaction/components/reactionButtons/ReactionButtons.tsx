import React, { useState, useContext, useEffect } from "react";
import { Box, useTheme } from "@mui/material";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { DislikeReason, DislikeReaction, LikeReaction, ReactionKind } from "src/chat/reaction/reaction.types";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
import ThumbDownAltIcon from "@mui/icons-material/ThumbDownAlt";
import ThumbUpOffAltIcon from "@mui/icons-material/ThumbUpOffAlt";
import ThumbDownOffAltIcon from "@mui/icons-material/ThumbDownOffAlt";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import DislikeReasonPopover from "src/chat/reaction/components/dislikeReasonPopover/DislikeReasonPopover";
import ReactionService from "src/chat/reaction/services/reactionService/reaction.service";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { ReactionError } from "src/error/commonErrors";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { MessageReaction } from "src/chat/ChatService/ChatService.types";

interface ReactionButtonsProps {
  messageId: string;
  currentReaction: MessageReaction | null;
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

export const ReactionButtons: React.FC<ReactionButtonsProps> = ({ messageId, currentReaction }) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const isOnline = useContext(IsOnlineContext);

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [reaction, setReaction] = useState<ReactionKind | null>(() => currentReaction?.kind ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSessionId] = useState<number | null>(UserPreferencesStateService.getInstance().getActiveSessionId());
  const reactionService = new ReactionService();

  useEffect(() => {
    // We expect to have an active session when this component is used
    if (!activeSessionId) {
      throw new ReactionError("Session id is not available");
    }
  }, [activeSessionId]);

  useEffect(() => {
    // Update reaction when currentReaction changes
    setReaction(currentReaction?.kind ?? null);
  }, [currentReaction]);

  const handlePopoverClose = async (reasons: DislikeReason[]) => {
    setIsPopoverOpen(false);
    setAnchorEl(null);
    
    if (!reasons.length) {
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    const currentReaction = reaction;
    setReaction(ReactionKind.DISLIKED); // Optimistically update UI

    try {
      await reactionService.sendReaction(activeSessionId!, messageId, new DislikeReaction(reasons));
    } catch (error) {
      setReaction(currentReaction); // Rollback to previous state
      console.error(new Error("Failed to submit the dislike feedback", { cause: error }));
      enqueueSnackbar("Failed to submit the feedback. Please try again.", { variant: "error" });

      // if it fails to submit the dislike reaction, we should revert to the previous reaction
      setReaction(currentReaction);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikeClick = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    const currentReaction = reaction;

    if (reaction === ReactionKind.LIKED) {
      try {
        setReaction(null); // Optimistically update UI
        await reactionService.deleteReaction(activeSessionId!, messageId);
      } catch (error) {
        setReaction(ReactionKind.LIKED); // Rollback to previous state
        console.error(new Error("Failed to remove the like feedback", { cause: error }));
        enqueueSnackbar("Failed to remove the feedback. Please try again.", { variant: "error" });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      setReaction(ReactionKind.LIKED); // Optimistically update UI
      await reactionService.sendReaction(activeSessionId!, messageId, new LikeReaction());
    } catch (error) {
      setReaction(currentReaction); // Rollback to previous state
      console.error(new Error("Failed to submit the like feedback", { cause: error }));
      enqueueSnackbar("Failed to submit the feedback. Please try again.", { variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDislikeClick = async (event: React.MouseEvent<HTMLElement>) => {
    if (isSubmitting) {
      return;
    }

    if (reaction === ReactionKind.DISLIKED) {
      try {
        setReaction(null); // Optimistically update UI
        await reactionService.deleteReaction(activeSessionId!, messageId);
      } catch (error) {
        setReaction(ReactionKind.DISLIKED); // Rollback to previous state
        console.error(new Error("Failed to remove the dislike feedback", { cause: error }));
        enqueueSnackbar("Failed to remove the feedback. Please try again.", { variant: "error" });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // If the user clicked dislike but has not yet disliked, show popover
    setAnchorEl(event.currentTarget);
    setIsPopoverOpen(true);
    setIsSubmitting(false);
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
          disabled={!isOnline || isSubmitting}
        >
          {reaction === ReactionKind.LIKED ? (
            <ThumbUpAltIcon
              data-testid={DATA_TEST_ID.ICON_LIKE_ACTIVE}
              sx={{
                color: theme.palette.text.secondary,
                fontSize: theme.fixedSpacing(theme.tabiyaSpacing.lg),
              }}
            />
          ) : (
            <ThumbUpOffAltIcon
              data-testid={DATA_TEST_ID.ICON_LIKE_DEFAULT}
              sx={{ fontSize: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}
            />
          )}
        </PrimaryIconButton>

        <PrimaryIconButton
          sx={{
            color: theme.palette.common.black,
          }}
          onClick={handleDislikeClick}
          data-testid={DATA_TEST_ID.BUTTON_DISLIKE}
          title="dislike"
          disabled={!isOnline || isSubmitting}
        >
          {reaction === ReactionKind.DISLIKED ? (
            <ThumbDownAltIcon
              data-testid={DATA_TEST_ID.ICON_DISLIKE_ACTIVE}
              sx={{
                color: theme.palette.text.secondary,
                fontSize: theme.fixedSpacing(theme.tabiyaSpacing.lg),
              }}
            />
          ) : (
            <ThumbDownOffAltIcon
              data-testid={DATA_TEST_ID.ICON_DISLIKE_DEFAULT}
              sx={{ fontSize: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}
            />
          )}
        </PrimaryIconButton>
      </Box>
      <DislikeReasonPopover
        anchorEl={anchorEl}
        open={isPopoverOpen}
        onClose={handlePopoverClose}
      />
    </>
  );
};

export default ReactionButtons;
