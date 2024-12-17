import React from 'react';
import { Box } from '@mui/material';

interface ReactionReasonPopoverProps {
  messageId: string;
  dataTestId: string;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onReasonSelect: (messageId: string, reason: string) => void;
}

const uniqueId = "9f3e2d1c-8b7a-4c6d-a5e9-2f1d8c7b3a4e";

export const DATA_TEST_ID = {
  REACTION_REASON_CONTAINER: `reaction-reason-container-${uniqueId}`,
  REACTION_REASON_BUTTON: `reaction-reason-button-${uniqueId}`,
};

export const ReactionReasonPopover: React.FC<ReactionReasonPopoverProps> = ({
  messageId,
  anchorEl,
  open,
  onClose,
  onReasonSelect,
  ...props
}) => {
  return (
    <Box>
      {/* TODO: Implement reaction reason popover */}
    </Box>
  );
};

export default ReactionReasonPopover;
