import { Meta } from "@storybook/react";
import ExperienceCategory from "src/experiences/experiencesDrawer/components/experienceCategory/ExperienceCategory";
import { generateRandomExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import StoreIcon from "@mui/icons-material/Store";

const meta: Meta<typeof ExperienceCategory> = {
  title: "Experiences/ExperienceCategory",
  component: ExperienceCategory,
  tags: ["autodocs"],
};

export default meta;

export const Shown = {
  args: {
    icon: <StoreIcon />,
    title: "Experience Category",
    experiences: generateRandomExperiences(1),
  },
};
