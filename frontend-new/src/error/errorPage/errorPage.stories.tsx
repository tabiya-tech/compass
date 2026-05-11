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

export const WithRefreshButton: Story = {
  args: {
    errorMessage: "Something went wrong. Try reloading the page...",
    showRefreshButton: true,
  },
};

export const WithSupportReference: Story = {
  args: {
    errorMessage:
      "Something went wrong with Njila. Try reloading the page, and if it keeps happening copy the reference below and share it with support.",
    supportPayload:
      "Error: ChunkLoadError: Loading chunk 17 failed\nWhere: Application\nReference: 550e8400-e29b-41d4-a716-446655440000\nSentry: 9a8b7c6d5e4f3a2b1c0d\nTime: 2026-04-21T10:32:15.421Z\nSession: 42",
    showRefreshButton: true,
  },
};
