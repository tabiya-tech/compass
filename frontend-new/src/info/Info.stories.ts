import type { Meta, StoryObj } from "@storybook/react";
import Info from "./Info";
import { faker } from "@faker-js/faker";

const meta: Meta<typeof Info> = {
  title: "Application/Info",
  component: Info,
  tags: ["autodocs"],
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof Info>;

const API_URL = "https://compass.tabiya.tech/info";

export const Shown: Story = {
  args: {},
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

function getFakerVersion() {
  return {
    date: faker.date.recent().toISOString(),
    branch: faker.git.branch(),
    buildNumber: faker.number.int({ min: 100, max: 1000 }).toString(),
    sha: faker.git.commitSha(),
  };
}
