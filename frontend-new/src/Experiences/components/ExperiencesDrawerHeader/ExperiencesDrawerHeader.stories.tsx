import { Meta } from "@storybook/react";
import ExperiencesDrawerHeader from "src/Experiences/components/ExperiencesDrawerHeader/ExperiencesDrawerHeader";

const meta: Meta<typeof ExperiencesDrawerHeader> = {
  title: "Experiences/ExperiencesDrawerHeader",
  component: ExperiencesDrawerHeader,
  tags: ["autodocs"],
  argTypes: { notifyOnClose: { action: "notifyOnClose" } },
};

export default meta;

export const Shown = {
  args: {},
};
