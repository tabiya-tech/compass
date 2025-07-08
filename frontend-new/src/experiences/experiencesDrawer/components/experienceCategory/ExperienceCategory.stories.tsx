import { Meta } from "@storybook/react";
import ExperienceCategory from "src/experiences/experiencesDrawer/components/experienceCategory/ExperienceCategory";
import { generateRandomExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import StoreIcon from "@mui/icons-material/Store";
import { DiveInPhase } from "src/experiences/experienceService/experiences.types";

const meta: Meta<typeof ExperienceCategory> = {
  title: "Experiences/ExperienceCategory",
  component: ExperienceCategory,
  tags: ["autodocs"],
};

export default meta;

export const DefaultVariantNoContextMenu = {
  args: {
    icon: <StoreIcon />,
    title: "Experience Category",
    experiences: generateRandomExperiences(1).map((experience) => ({
      ...experience,
      exploration_phase: DiveInPhase.EXPLORING_SKILLS,
    })),
  },
};

export const DefaultVariantWithContextMenu = {
  args: {
    icon: <StoreIcon />,
    title: "Experience Category",
    experiences: generateRandomExperiences(1).map((experience) => ({
      ...experience,
      exploration_phase: DiveInPhase.PROCESSED,
    })),
  },
};
