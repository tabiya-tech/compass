import React from "react";

import { Box, IconButton, Tooltip, useTheme } from "@mui/material";

export interface HelpTipProps {
  children?: React.ReactNode;
  "data-testid"?: string;
  icon: React.ReactNode;
}

const uniqueId = "4b757f12-fb67-4a59-94b1-b8a2498a7a49";

export const DATA_TEST_ID = {
  HELP_ICON: `help-icon-${uniqueId}`,
};

/**
 * HelpTip is responsible for showing a tooltip that shows a helpful dialog with some react component
 * @param props
 * @constructor
 */

const HelpTip: React.FC<HelpTipProps> = (props: Readonly<HelpTipProps>) => {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);

  const handleClose = () => setOpen(false);

  const handleOpen = () => setOpen(true);

  return (
    <Tooltip
      open={open}
      aria-label="help"
      data-testid={props["data-testid"]}
      describeChild
      disableTouchListener
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onClick={handleOpen}
      onBlur={handleClose}
      title={<Box>{props.children}</Box>}
    >
      <IconButton
        data-testid={DATA_TEST_ID.HELP_ICON}
        sx={{
          padding: 0,
          color: theme.typography.body1.color,
          marginRight: 0.5,
        }}
      >
        {props.icon}
      </IconButton>
    </Tooltip>
  );
};

export default HelpTip;
