import React from 'react';
import { Box } from '@mui/material';
import { ReactionType } from "src/feedback/reaction/reaction.types";

interface ReactionButtonsProps {
  messageId: string;
  dataTestId: string;
  currentReaction: ReactionType;
  notifyReactionChange: (messageId: string, reaction: ReactionType) => void;
}

const uniqueId = "8d4e6f2c-9a3b-4c5d-b1e7-5f9d8a2b3c4e";

export const DATA_TEST_ID = {
  REACTION_BUTTON_LIKE: `reaction-button-like-${uniqueId}`,
  REACTION_BUTTON_DISLIKE: `reaction-button-dislike-${uniqueId}`,
};

export const ReactionButtons: React.FC<ReactionButtonsProps> = ({
  messageId,
  currentReaction,
  notifyReactionChange,
  ...props
}) => {
  return (
    <Box 
      display="flex" 
      gap={1} 
      data-testid={props['dataTestId']}
    >
      {/* Implement reaction buttons */}
    </Box>
  );
};

export default ReactionButtons;