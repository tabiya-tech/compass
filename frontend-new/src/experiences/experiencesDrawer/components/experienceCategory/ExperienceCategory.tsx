import React from "react";
import { Theme } from "@mui/material/styles";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Experience } from "src/experiences/experienceService/experiences.types";
import ExperiencesDrawerContent from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import HelpTip from "src/theme/HelpTip/HelpTip";
import InfoIcon from "@mui/icons-material/Info";

interface ExperienceCategoryProps {
  icon: React.ReactNode;
  title: string;
  experiences: Experience[];
  tooltipText?: string;
  onEditExperience: (experience: Experience) => void;
  onDeleteExperience: (experience: Experience) => void;
}

const ExperienceCategory: React.FC<ExperienceCategoryProps> = ({
  icon,
  title,
  experiences,
  tooltipText,
  onEditExperience,
  onDeleteExperience,
}) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  if (experiences.length === 0) return null;

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Box display="flex" alignItems="center" gap={isSmallMobile ? 2 : 1}>
        {React.cloneElement(icon as React.ReactElement, { sx: { color: theme.palette.text.secondary } })}
        <Typography variant="subtitle1" fontWeight="bold" color={theme.palette.text.secondary}>
          {title || <i>Untitled!</i>}
        </Typography>
        {tooltipText && <HelpTip icon={<InfoIcon />}>{tooltipText}</HelpTip>}
      </Box>
      <Box display="flex" flexDirection="column" gap={isSmallMobile ? 8 : 4}>
        {experiences.map((experience, index) => (
          <ExperiencesDrawerContent key={index} experience={experience} onEdit={onEditExperience} onDelete={onDeleteExperience}/>
        ))}
      </Box>
    </Box>
  );
};

export default ExperienceCategory;
