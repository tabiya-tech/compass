import * as React from "react";
import { Meta, type StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import { Box } from "@mui/material";
import ReactionReasonPopover, {
  ReactionReasonPopoverProps,
} from "src/feedback/reaction/components/reactionReasonPopover/ReactionReasonPopover";

const meta: Meta<typeof ReactionReasonPopover> = {
  title: "Feedback/Reaction/ReactionReasonPopover",
  component: ReactionReasonPopover,
  tags: ["autodocs"],
  args: {
    onClose: action("onClose"),
    onReasonSelect: action("onReasonSelect"),
  },
};

export default meta;

type Story = StoryObj<typeof ReactionReasonPopover>;

const CenteredPopover: React.FC<ReactionReasonPopoverProps> = (args) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (containerRef.current) {
      setAnchorEl(containerRef.current);
    }
  }, [containerRef]);

  return (
    <Box display="flex" justifyContent="center" alignItems="center" height="10vh" ref={containerRef}>
      {anchorEl && <ReactionReasonPopover {...args} anchorEl={anchorEl} />}
    </Box>
  );
};

export const Shown: Story = {
  render: (args) => <CenteredPopover {...args} />,
  args: {
    anchorEl: document.createElement("div"),
    open: true,
  },
};
