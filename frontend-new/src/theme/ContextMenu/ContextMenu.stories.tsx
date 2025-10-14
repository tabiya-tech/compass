import { Meta, StoryObj } from "@storybook/react";
import * as React from "react";
import { useEffect } from "react";
import Box from "@mui/material/Box";
import { action } from "@storybook/addon-actions";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import { SendOutlined } from "@mui/icons-material";
import ContextMenu, { ContextMenuProps } from "./ContextMenu";
import { Typography } from "@mui/material";

const meta: Meta<typeof ContextMenu> = {
  title: "Components/ContextMenu",
  component: ContextMenu,
  tags: ["autodocs"],
  argTypes: {
    open: {
      control: {
        type: "boolean",
      },
    },
    notifyOnClose: {
      table: {
        disable: true,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ContextMenu>;

export const Shown: Story = {
  render: (args) => <SetupComponent {...args} />,
  args: {
    items: [
      {
        id: "item-1",
        text: "Item 1",
        icon: <CloudDownloadIcon />,
        action: action("Item 1 clicked"),
        disabled: false,
      },
      {
        id: "item-2",
        text: "Item 2",
        icon: <SendOutlined />,
        action: action("Item 2 clicked"),
        disabled: false,
      },
    ],
  },
};

export const DisabledMenuItems: Story = {
  render: (args) => <SetupComponent {...args} />,
  args: {
    items: [
      {
        id: "item-1",
        text: "Item 1",
        icon: <CloudDownloadIcon />,
        action: action("Item 1 clicked"),
        disabled: true,
      },
      {
        id: "item-2",
        text: "Item 2",
        icon: <SendOutlined />,
        action: action("Item 2 clicked"),
        disabled: true,
      },
    ],
  },
};

export const WithoutIcons: Story = {
  render: (args) => <SetupComponent {...args} />,
  args: {
    items: [
      {
        id: "item-1",
        text: "Item 1",
        action: action("Item 1 clicked"),
        disabled: false,
      },
      {
        id: "item-2",
        text: "Item 2",
        action: action("Item 2 clicked"),
        disabled: false,
      },
    ],
  },
};

export const Mixed: Story = {
  render: (args) => <SetupComponent {...args} />,
  args: {
    items: [
      {
        id: "item-1",
        text: "Item 1",
        icon: <CloudDownloadIcon />,
        action: action("Item 1 clicked"),
        disabled: false,
      },
      {
        id: "item-2",
        text: "Item 2",
        action: action("Item 2 clicked"),
        disabled: true,
      },
      {
        id: "item-3",
        text: "Item 2",
        action: action("Item 2 clicked"),
        disabled: false,
      },
      {
        id: "item-4",
        text: "Item 3",
        icon: <SendOutlined />,
        action: action("Item 3 clicked"),
        disabled: true,
      },
    ],
  },
};

export const WithCustomItem: Story = {
  render: (args) => <SetupComponent {...args} />,
  args: {
    items: [
      {
        id: "item-1",
        text: "Regular Action",
        icon: <SendOutlined />,
        action: action("Regular Action clicked"),
        disabled: false,
      },
      {
        id: "item-3",
        text: "Regular Action",
        trailingIcon: <SendOutlined />,
        icon: <SendOutlined />,
        action: action("Regular Action clicked"),
        disabled: false,
      },
      {
        id: "custom-1",
        text: "Custom Section",
        disabled: false,
        action: action("Custom container clicked"),
        customNode: (
          <Box sx={{ width: "100%", px: 2, py: 1 }}>
            <Typography variant="caption" fontWeight="bold">
              Custom Item Section
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                py: 0.5,
                cursor: "pointer",
              }}
              onClick={action("Select Custom Item")}
            >
              <CloudDownloadIcon fontSize="small" color="action" />
              <Typography variant="caption">Custom item</Typography>
            </Box>
          </Box>
        ),
      },
    ],
  },
};

function SetupComponent(props: Readonly<ContextMenuProps>) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  useEffect(() => {
    const anchor = document.getElementById("anchor-on-me");
    setAnchorEl(anchor);
  }, []);

  return (
    <>
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <div style={{ border: "1px dashed", height: "20px", width: "100px" }} id="anchor-on-me" />
      </Box>
      <ContextMenu
        anchorEl={anchorEl}
        open={anchorEl !== null}
        notifyOnClose={action("notifyOnClose")}
        items={props.items}
      />
    </>
  );
}
