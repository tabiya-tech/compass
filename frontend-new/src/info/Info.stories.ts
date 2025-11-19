import type { Meta, StoryObj } from "@storybook/react";
import Info from "./Info";
import { faker } from "@faker-js/faker";

const meta: Meta<typeof Info> = {
  title: "Application/Info",
  component: Info,
  tags: ["autodocs"],
  argTypes: {
    notifyOnClose: { action: "notifyOnClose" },
  },
};

export default meta;
type Story = StoryObj<typeof Info>;

const API_URL = "http://dev.brujula.tabiya.tech/api/version";

export const Shown: Story = {
  args: { isOpen: true },
  parameters: {
    mockData: [
      {
        url: API_URL,
        method: "GET",
        status: 200,
        response: getFakerVersion(),
      },
      {
        url: "data/version.json",
        method: "GET",
        status: 200,
        response: getFakerVersion(),
      },
    ],
  },
};

export const ShownFetchIsSlow: Story = {
  args: { isOpen: true },
  parameters: {
    mockData: [
      {
        url: API_URL,
        method: "GET",
        status: 200,
        delay: 5000,
        response: getFakerVersion(),
      },
      {
        url: "data/version.json",
        method: "GET",
        status: 200,
        delay: 5000,
        response: getFakerVersion(),
      },
    ],
  },
};

function getFakerVersion() {
  return {
    date: faker.date.recent().toISOString(),
    branch: faker.git.branch(),
    buildNumber: faker.number.int({ min: 100, max: 1000 }).toString(),
    sha: faker.git.commitSha(),
  };
}
