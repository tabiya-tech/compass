import { Meta, StoryObj } from "@storybook/react";
import ErrorPage from "src/error/errorPage/ErrorPage";

const meta: Meta<typeof ErrorPage> = {
  title: "Application/ErrorPage",
  component: ErrorPage,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;

type Story = StoryObj<typeof ErrorPage>;

export const Shown: Story = {
  args: {
    errorMessage: "An error occurred",
  },
};

export const ShownWithNoErrorMessage: Story = {
  args: {
    errorMessage: "",
  },
};

export const ShownWithLongErrorMessage: Story = {
  args: {
    errorMessage:
      "An error occurred. An error occurred. An error occurred. An error occurred. An error occurred. An error occurred.",
  },
};

export const ShownWith404ErrorMessage: Story = {
  args: {
    errorMessage: "404 Error - Page Not Found",
  },
};
