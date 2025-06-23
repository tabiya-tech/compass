import React, { useMemo } from "react";
import { Box, Chip, Grid, Popover, Skeleton, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Experience } from "src/experiences/experienceService/experiences.types";
import { Theme } from "@mui/material/styles";
import HelpTip from "src/theme/HelpTip/HelpTip";
import InfoIcon from "@mui/icons-material/Info";
import EditIcon from "@mui/icons-material/Edit";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";

const uniqueId = "34a59a9e-e7f6-4a10-8b72-0fd401c727de";

export const DATA_TEST_ID = {
  LOADING_EXPERIENCES_DRAWER_CONTENT_CONTAINER: `experiences-drawer-content-container-${uniqueId}`,
  EXPERIENCES_DRAWER_CONTENT_CONTAINER: `experiences-drawer-content-container-${uniqueId}`,
  EXPERIENCES_DRAWER_CONTENT_DATE: `experiences-drawer-content-date-${uniqueId}`,
  EXPERIENCES_DRAWER_CONTENT_OCCUPATION: `experiences-drawer-content-occupation-${uniqueId}`,
  EXPERIENCES_DRAWER_CONTENT_SKILLS: `experiences-drawer-content-skills-${uniqueId}`,
  EXPERIENCES_DRAWER_SKILLS_CONTAINER: `experiences-drawer-skills-container-${uniqueId}`,
  EXPERIENCES_DRAWER_CONTENT_SUMMARY: `experiences-drawer-content-summary-${uniqueId}`,
  EXPERIENCES_DRAWER_CHIP: `experiences-drawer-chip-${uniqueId}`,
  EXPERIENCES_DRAWER_POPOVER: `experiences-drawer-popover-${uniqueId}`,
  EXPERIENCES_DRAWER_EDIT_BUTTON: `experiences-drawer-edit-button-${uniqueId}`,
};

interface ExperienceProps {
  experience: Experience;
  onEdit: (experience: Experience) => void;
}

export const capitalizeFirstLetter = (string: string): string => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const ExperiencesDrawerContent: React.FC<ExperienceProps> = ({ experience, onEdit }) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const [skillDescription, setSkillDescription] = React.useState<string>("");
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  const formattedSkills = useMemo(() => {
    if (experience.top_skills.length === 0) return [];
    return experience.top_skills.map((skill) => skill);
  }, [experience.top_skills]);

  const handleEditClick = () => {
    onEdit(experience);
  };

  const handleChipClick = (event: React.MouseEvent<HTMLElement>, description: string) => {
    setAnchorEl(event.currentTarget);
    setSkillDescription(description);
    setIsOpen(true);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setIsOpen(false);
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={isSmallMobile ? theme.fixedSpacing(theme.tabiyaSpacing.sm) : theme.tabiyaSpacing.md}
      data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_CONTAINER}
    >
      <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography
            variant="body1"
            fontWeight="bold"
            data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_OCCUPATION}
          >
            {experience.experience_title ? experience.experience_title : <i>Untitled!</i>}
          </Typography>
          <PrimaryIconButton
            onClick={handleEditClick}
            sx={{ color: theme.palette.common.black }}
            title="Edit"
            data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_EDIT_BUTTON}
          >
            <EditIcon />
          </PrimaryIconButton>
        </Box>
        <Typography
          variant="caption"
          sx={{ color: theme.palette.text.secondary }}
          data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_DATE}
        >
          {/* display the start and end dates */}
          {experience.timeline.end && experience.timeline.start
            ? `${experience.timeline.start} — ${experience.timeline.end}`
            : experience.timeline.start || experience.timeline.end}

          {(experience.timeline.start || experience.timeline.end) && experience.company && ", "}

          {/* display the company if it exists */}
          {experience.company && experience.company}

          {/* display the location if it exists */}
          {experience.location && <i>{` (${experience.location})`}</i>}
        </Typography>
      </Box>
      {experience.summary && (
        <Typography variant="body2" data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_SUMMARY}>
          {experience.summary}
        </Typography>
      )}
      <Box display="flex" alignItems="center">
        <Typography
          variant="body1"
          sx={{ wordBreak: "break-all" }}
          data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_SKILLS}
        >
          <b>Top Skills</b>
        </Typography>
        <HelpTip icon={<InfoIcon sx={{ padding: 0.1 }} />}>Tap on the skill to see more details</HelpTip>
      </Box>
      <Box
        display="flex"
        flexDirection="row"
        alignItems="center"
        flexWrap="wrap"
        gap={2}
        data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_SKILLS_CONTAINER}
      >
        {formattedSkills.length === 0 ? (
          <Typography>No skills discovered yet</Typography>
        ) : (
          formattedSkills.map((skill) => (
            <Chip
              key={skill.UUID}
              label={capitalizeFirstLetter(skill.preferredLabel)}
              sx={{ color: theme.palette.text.secondary, backgroundColor: theme.palette.grey[100] }}
              onClick={(event) => handleChipClick(event, skill.description)}
              data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CHIP}
            />
          ))
        )}
      </Box>
      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        onClose={handleClose}
        data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_POPOVER}
      >
        <Typography sx={{ maxWidth: 500, padding: isSmallMobile ? 4 : 2 }}>{skillDescription}</Typography>
      </Popover>
    </Box>
  );
};

export const LoadingExperienceDrawerContent = () => {
  const theme = useTheme();

  return (
    <Grid container alignItems="top" data-testid={DATA_TEST_ID.LOADING_EXPERIENCES_DRAWER_CONTENT_CONTAINER}>
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
};

export default ExperiencesDrawerContent;
