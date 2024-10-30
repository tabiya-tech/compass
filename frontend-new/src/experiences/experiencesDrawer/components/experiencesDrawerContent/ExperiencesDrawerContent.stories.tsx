import { Meta } from "@storybook/react";
import ExperiencesDrawerContent, {
  LoadingExperienceDrawerContent,
} from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import { generateRandomExperiences } from "src/experiences/experiencesDrawer/experienceService/_test_utilities/mockExperiencesResponses";

const meta: Meta<typeof ExperiencesDrawerContent> = {
  title: "Experiences/ExperiencesDrawerContent",
  component: ExperiencesDrawerContent,
  tags: ["autodocs"],
};

export default meta;

export const Shown = {
  args: {
    experience: generateRandomExperiences(1)[0],
  },
};

export const Loading = {
  render: () => <LoadingExperienceDrawerContent />,
};

export const ShownWithNoCompany = {
  args: {
    experience: {
      ...generateRandomExperiences(1)[0],
      company: "",
    },
  },
};

export const ShownWithNoLocation = {
  args: {
    experience: {
      ...generateRandomExperiences(1)[0],
      location: "",
    },
  },
};

export const ShownWithNoDate = {
  args: {
    experience: {
      ...generateRandomExperiences(1)[0],
      start_date: "",
      end_date: "",
    },
  },
};
