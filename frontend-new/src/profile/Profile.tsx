import React from "react";
import { Box, useTheme, Stack } from "@mui/material";
import { Skill } from "src/experiences/experienceService/experiences.types";
import { SecurityCard } from "./components/SecurityCard/SecurityCard";
import { PreferencesCard } from "./components/PreferencesCard/PreferencesCard";
import { ProfileCard } from "./components/ProfileCard/ProfileCard";
import { SkillsDiscoveredCard } from "./components/SkillsDiscoveredCard/SkillsDiscoveredCard";
import { CareerExplorerCard } from "./components/CareerExplorerCard/CareerExplorerCard";
import { ModuleProgressCard } from "./components/ModuleProgressCard/ModuleProgressCard";
import CareerReadinessProgressBanner from "src/careerReadiness/components/CareerReadinessProgressBanner/CareerReadinessProgressBanner";
import type { ModuleSummary } from "src/careerReadiness/types";
import type { UserSectorEngagementItem } from "src/careerExplorer/services/CareerExplorerService";

const uniqueId = "a7f8e4b2-9c3d-4a1e-8f6b-2d3e4a5b6c7d";

export const DATA_TEST_ID = {
  PROFILE_CONTENT: `profile-content-${uniqueId}`,
};

export interface ProfileProps {
  email: string | null;
  language: string | null;
  termsAcceptedDate: Date | null;
  name: string | null;
  location: string | null;
  school: string | null;
  program: string | null;
  year: string | null;
  skills: Skill[];
  educationSkills: Skill[];
  totalExperiences: number;
  exploredExperiences: number;
  modules: ModuleSummary[];
  skillsInterestsProgress: number;
  careerExplorerSectors: UserSectorEngagementItem[];
  isLoadingSecurity: boolean;
  isLoadingPreferences: boolean;
  isLoadingProfile: boolean;
  isLoadingSkills: boolean;
  isLoadingCareerExplorer: boolean;
}

export const Profile: React.FC<ProfileProps> = ({
  email,
  language,
  termsAcceptedDate,
  name,
  location,
  school,
  program,
  year,
  skills,
  educationSkills,
  totalExperiences,
  exploredExperiences,
  modules,
  skillsInterestsProgress: _skillsInterestsProgress,
  careerExplorerSectors,
  isLoadingSecurity,
  isLoadingPreferences,
  isLoadingProfile,
  isLoadingSkills,
  isLoadingCareerExplorer,
}) => {
  const theme = useTheme();
  const clampPercentage = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

  // Education Skills are programme skills only
  const educationProgress = clampPercentage(educationSkills.length > 0 ? 100 : 0);

  // Work progress reflects explored experiences
  const workProgress =
    totalExperiences > 0 ? clampPercentage((exploredExperiences / totalExperiences) * 100) : clampPercentage(0);

  // Overall Profile Strength equally weights Education Skills and Work & Other Skills
  const overallProgress = clampPercentage((educationProgress + workProgress) / 2);

  return (
    <Box
      sx={{
        padding: theme.fixedSpacing(theme.tabiyaSpacing.lg),
        maxWidth: "var(--layout-content-max-width, 80rem)",
        width: "100%",
        margin: "0 auto",
      }}
      data-testid={DATA_TEST_ID.PROFILE_CONTENT}
    >
      <Stack spacing={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
        {/* Identity */}
        <ProfileCard
          name={name}
          location={location}
          school={school}
          program={program}
          year={year}
          isLoading={isLoadingProfile}
        />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "420px 1fr" },
            gap: theme.fixedSpacing(theme.tabiyaSpacing.lg),
            alignItems: "start",
          }}
        >
          <Stack spacing={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
            <ModuleProgressCard
              overallProgress={overallProgress}
              educationProgress={educationProgress}
              workProgress={workProgress}
            />
            <CareerReadinessProgressBanner modules={modules} />
          </Stack>

          <Stack spacing={theme.fixedSpacing(theme.tabiyaSpacing.md)} sx={{ minWidth: 0 }}>
            <SkillsDiscoveredCard
              skills={skills}
              educationSkills={educationSkills}
              isLoading={isLoadingSkills}
              school={school}
              program={program}
            />
            <CareerExplorerCard sectors={careerExplorerSectors} isLoading={isLoadingCareerExplorer} />

            {/* Account info */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
              }}
            >
              <SecurityCard email={email} isLoading={isLoadingSecurity} />
              <PreferencesCard
                language={language}
                acceptedTcDate={termsAcceptedDate}
                isLoading={isLoadingPreferences}
              />
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};
