import React from "react";
import { Theme } from "@mui/material/styles";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Experience } from "src/experiences/experienceService/experiences.types";
import ExperiencesDrawerContent from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";

interface ExperienceCategoryProps {
  icon: React.ReactNode;
  title: string;
  experiences: Experience[];
}

const ExperienceCategory: React.FC<ExperienceCategoryProps> = ({ icon, title, experiences }) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  if (experiences.length === 0) return null;

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Box display="flex" alignItems="center" gap={isSmallMobile ? 2 : 1}>
        {React.cloneElement(icon as React.ReactElement, { sx: { color: theme.palette.text.secondary } })}
        <Typography variant="subtitle1" fontWeight="bold" color={theme.palette.text.secondary}>
          {title ? title : <i>Untitled!</i>}
        </Typography>
      </Box>
      <Box display="flex" flexDirection="column" gap={isSmallMobile ? 8 : 4}>
        {experiences.map((experience, index) => (
          <ExperiencesDrawerContent key={index} experience={experience} />
        ))}
      </Box>
    </Box>
  );
};

export default ExperienceCategory;
