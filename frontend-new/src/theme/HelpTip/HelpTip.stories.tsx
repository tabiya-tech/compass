import { Meta, StoryObj } from "@storybook/react";
import HelpTip from "./HelpTip";
import InfoIcon from "@mui/icons-material/Info";

const meta: Meta<typeof HelpTip> = {
  title: "components/HelpTip",
  component: HelpTip,
  tags: ["autodocs"],
  args: {
    children: (
      <div>
        <p>HelpTip is responsible for showing a tooltip that shows a helpful dialog with some react component</p>
        <p>@param props</p>
        <p>@constructor</p>
      </div>
    ),
    icon: <InfoIcon />,
  },
};

type Story = StoryObj<typeof HelpTip>;

export const Shown: Story = {};

export default meta;
