import React from "react";
import { Box, Grid, Skeleton, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import { Theme } from "@mui/material/styles";

const uniqueId = "34a59a9e-e7f6-4a10-8b72-0fd401c727de";

export const DATA_TEST_ID = {
  EXPERIENCES_DRAWER_CONTENT_CONTAINER: `experiences-drawer-content-container-${uniqueId}`,
  EXPERIENCES_DRAWER_CONTENT_DATE: `experiences-drawer-content-date-${uniqueId}`,
  EXPERIENCES_DRAWER_CONTENT_OCCUPATION: `experiences-drawer-content-occupation-${uniqueId}`,
  EXPERIENCES_DRAWER_CONTENT_SKILLS: `experiences-drawer-content-skills-${uniqueId}`,
};

interface ExperienceProps {
  experience: Experience;
  isLoading: boolean;
}

const ExperiencesDrawerContent: React.FC<ExperienceProps> = ({ experience, isLoading }) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  if (isLoading) {
    return (
      <Grid container alignItems="top" data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_CONTAINER}>
        <Grid item xs={8}>
          <Box display="flex" flexDirection="column" gap={theme.tabiyaSpacing.md}>
            <Skeleton variant="text" width="60%" data-testid="skeleton-text" />
            <Skeleton variant="text" width="90%" data-testid="skeleton-text" />
          </Box>
          <Grid item xs={4}>
            <Skeleton variant="text" width="80%" data-testid="skeleton-text" />
          </Grid>
        </Grid>
      </Grid>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={isSmallScreen ? 4 : theme.tabiyaSpacing.md}
      data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_CONTAINER}
    >
      <Typography variant="body1" fontWeight="bold" data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_OCCUPATION}>
        {experience.experience_title}
      </Typography>
      <Typography variant="body1" data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_SKILLS}>
        <b>Top Skills:</b> {experience.top_skills.map((skill) => skill.preferredLabel).join(", ")}
      </Typography>
      <Typography variant="body2" data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_DATE}>
        {experience.end_date && experience.start_date
          ? `${experience.start_date} — ${experience.end_date}`
          : experience.start_date || experience.end_date}
      </Typography>
    </Box>
  );
};

export default ExperiencesDrawerContent;
