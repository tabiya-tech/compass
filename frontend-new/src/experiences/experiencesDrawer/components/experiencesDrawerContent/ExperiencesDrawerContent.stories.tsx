import { Meta } from "@storybook/react";
import ExperiencesDrawerContent, {
  LoadingExperienceDrawerContent,
} from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import { generateRandomExperiences, mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";
import { DiveInPhase } from "src/experiences/experienceService/experiences.types";
import { action } from "@storybook/addon-actions";

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
      timeline: {
        start: "",
        end: "",
      },
    },
  },
};

export const ShownWithNoSummary = {
  args: {
    experience: {
      ...generateRandomExperiences(1)[0],
      summary: "",
    },
  },
};

export const ShownWhenEditable = {
  args: {
    experience: {
      ...generateRandomExperiences(1)[0],
      exploration_phase: DiveInPhase.PROCESSED,
    },
  },
};

export const WithRestoreToOriginal = {
  args: {
    experience: { ...mockExperiences[0], exploration_phase: DiveInPhase.PROCESSED },
    onEdit: action("onEdit"),
    onDelete: action("onDelete"),
    onRestoreToOriginal: action("onRestoreToOriginal"),
  },
  parameters: {
    docs: {
      description: {
        story: "Experience with restore to original functionality enabled. Click the more menu (⋮) to see the 'Restore to original' option.",
      },
    },
  },
};

export const RestoreVariant = {
  args: {
    experience: { ...mockExperiences[0], exploration_phase: DiveInPhase.PROCESSED },
    onRestore: action("onRestore"),
    variant: "RESTORE",
  },
  parameters: {
    docs: {
      description: {
        story: "Experience in restore variant mode. Shows a restore icon instead of the context menu.",
      },
    },
  },
};
