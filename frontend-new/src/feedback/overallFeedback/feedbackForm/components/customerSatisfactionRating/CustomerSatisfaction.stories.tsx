import { Meta, type StoryObj } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import CustomerSatisfactionRating from "./CustomerSatisfaction";

const meta: Meta<typeof CustomerSatisfactionRating> = {
  title: "Feedback/CustomerSatisfactionRating",
  component: CustomerSatisfactionRating,
  tags: ["autodocs"],
  args: {
    notifyOnCustomerSatisfactionRatingSubmitted: action("notifyOnCustomerSatisfactionRatingSubmitted"),
  },
};

export default meta;

type Story = StoryObj<typeof CustomerSatisfactionRating>;

export const Default: Story = {};
