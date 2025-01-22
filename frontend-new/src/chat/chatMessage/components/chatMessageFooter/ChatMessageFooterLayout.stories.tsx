import type { Meta, StoryObj } from "@storybook/react";
import ChatMessageFooter from "./ChatMessageFooterLayout";
import Timestamp from "./components/timestamp/Timestamp";
import { VisualMock } from "src/_test_utilities/VisualMock";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";

const meta: Meta<typeof ChatMessageFooter> = {
  title: "Chat/ChatMessageFooter/Layout",
  component: ChatMessageFooter,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof ChatMessageFooter>;

export const ShownWithTimestampCompassSender: Story = {
  args: {
    sender: ConversationMessageSender.COMPASS,
    children: <Timestamp sentAt={new Date().toISOString()} />,
  },
}
export const ShownWithTimestampUserSender: Story = {
  args: {
    sender: ConversationMessageSender.USER,
    children: <Timestamp sentAt={new Date().toISOString()} />,
  },
}

export const OneFullWidthChild: Story = {
  args: {
    children: <VisualMock text={"only child"} />,
  },
};
export const OneFixedWidthChild: Story = {
  args: {
    children: <VisualMock maxWidth={"200px"} text={"only child"} />,
  },
}

export const MultipleFullWidthChildren: Story = {
  args: {
    children: [
      <VisualMock text={"child 1"} key={"1"}/>,
      <VisualMock text={"child 2"} key={"2"}/>,
    ],
  },
};

export const MultipleFixedWidthChildren: Story = {
  args: {
    children: [
      <VisualMock maxWidth={"200px"} text={"child 1"} key={"1"}/>,
      <VisualMock maxWidth={"200px"} text={"child 2"} key={"2"}/>,
    ],
  },
};