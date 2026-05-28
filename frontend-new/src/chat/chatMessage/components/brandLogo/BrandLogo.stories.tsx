import type { Meta, StoryObj } from "@storybook/react";
import BrandLogo from "src/chat/chatMessage/components/brandLogo/BrandLogo";
import { EnvVariables } from "src/envService";

const meta: Meta<typeof BrandLogo> = {
  title: "Chat/BrandLogo",
  component: BrandLogo,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof BrandLogo>;

export const Default: Story = {};

export const SmallSize: Story = {
  args: { size: 16 },
};

export const LargeSize: Story = {
  args: { size: 48 },
};

export const WithCustomLogoUrl: Story = {
  decorators: [
    (Story) => {
      (window as any).tabiyaConfig = {
        ...(window as any).tabiyaConfig,
        [EnvVariables.FRONTEND_APP_ICON_URL]: window.btoa("https://placehold.co/48x48/3d5afe/ffffff?text=L"),
      };
      return <Story />;
    },
  ],
  args: { size: 48 },
};

export const FallbackLogo: Story = {
  decorators: [
    (Story) => {
      (window as any).tabiyaConfig = {
        ...(window as any).tabiyaConfig,
        [EnvVariables.FRONTEND_APP_ICON_URL]: window.btoa(""),
      };
      return <Story />;
    },
  ],
  args: { size: 48 },
};
