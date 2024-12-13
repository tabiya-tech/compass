import React from "react";
import { Theme } from "@mui/material/styles";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import ApproveModal, { ApproveModalProps } from "src/theme/approveModal/ApproveModal";

export interface TextConfirmModalParagraph {
  id: string;
  text: string;
}

export interface TextConfirmModalDialogProps extends Omit<ApproveModalProps, "content"> {
  textParagraphs: TextConfirmModalParagraph[];
}

const uniqueId = "e2c24e08-1225-4aa0-9fdf-95ac6f0c81c3";

export const DATA_TEST_ID = {
  TEXT_CONFIRM_MODAL_CONTENT: `text-confirm-modal-content-${uniqueId}`,
  TEXT_CONFIRM_MODAL_PARAGRAPH: `text-confirm-modal-paragraph-${uniqueId}`,
};

const TextConfirmModalDialog: React.FC<TextConfirmModalDialogProps> = (props) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  const content = (
    <Box
      display="flex"
      flexDirection="column"
      gap={isSmallMobile ? theme.tabiyaSpacing.lg : theme.tabiyaSpacing.md}
      data-testid={DATA_TEST_ID.TEXT_CONFIRM_MODAL_CONTENT}
    >
      {props.textParagraphs.map((paragraph, _index) => (
        <Typography key={paragraph.id} variant="body1" data-testid={DATA_TEST_ID.TEXT_CONFIRM_MODAL_PARAGRAPH}>
          {paragraph.text}
        </Typography>
      ))}
    </Box>
  );

  return <ApproveModal {...props} content={content} />;
};

export default TextConfirmModalDialog;
