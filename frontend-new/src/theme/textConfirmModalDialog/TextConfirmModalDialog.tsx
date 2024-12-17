import React from "react";
import { Theme } from "@mui/material/styles";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import ConfirmModalDialog, { ConfirmModalDialogProps } from "src/theme/confirmModalDialog/ConfirmModalDialog";

export interface TextConfirmModalParagraph {
  id: string;
  text: string;
}

export interface TextConfirmModalDialogProps extends Omit<ConfirmModalDialogProps, "content"> {
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
      tabIndex={0}
    >
      {props.textParagraphs.map((paragraph, _index) => (
        <Typography key={paragraph.id} variant="body1" data-testid={DATA_TEST_ID.TEXT_CONFIRM_MODAL_PARAGRAPH}>
          {paragraph.text}
        </Typography>
      ))}
    </Box>
  );

  return <ConfirmModalDialog {...props} content={content} />;
};

export default TextConfirmModalDialog;
