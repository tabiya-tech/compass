import * as React from "react";
import { Meta, type StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import { Box } from "@mui/material";
import DislikeReasonPopover, {
  DislikeReasonPopoverProps,
} from "src/chat/reaction/components/dislikeReasonPopover/DislikeReasonPopover";

const meta: Meta<typeof DislikeReasonPopover> = {
  title: "Chat/Reaction/ReactionReasonPopover",
  component: DislikeReasonPopover,
  tags: ["autodocs"],
  args: {
    onClose: action("onClose"),
  },
};

export default meta;

type Story = StoryObj<typeof DislikeReasonPopover>;

const CenteredPopover: React.FC<DislikeReasonPopoverProps> = (args) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (containerRef.current) {
      setAnchorEl(containerRef.current);
    }
  }, [containerRef]);

  return (
    <Box display="flex" justifyContent="center" alignItems="center" height="10vh" ref={containerRef}>
      {anchorEl && <DislikeReasonPopover {...args} anchorEl={anchorEl} />}
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
