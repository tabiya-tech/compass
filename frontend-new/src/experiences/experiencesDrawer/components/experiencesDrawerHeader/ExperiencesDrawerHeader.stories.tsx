import { Meta } from "@storybook/react";
import ExperiencesDrawerHeader from "src/experiences/experiencesDrawer/components/experiencesDrawerHeader/ExperiencesDrawerHeader";

const meta: Meta<typeof ExperiencesDrawerHeader> = {
  title: "Experiences/ExperiencesDrawerHeader",
  component: ExperiencesDrawerHeader,
  tags: ["autodocs"],
  argTypes: { notifyOnClose: { action: "notifyOnClose" } },
};

export default meta;

export const Shown = {
  args: {
    title: "Experiences and Skills",
  },
};
