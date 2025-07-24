import React, { useContext, useMemo } from "react";
import { Box, Chip, Grid, Popover, Skeleton, Typography, useMediaQuery, useTheme } from "@mui/material";
import { DiveInPhase, Experience } from "src/experiences/experienceService/experiences.types";
import { Theme } from "@mui/material/styles";
import HelpTip from "src/theme/HelpTip/HelpTip";
import InfoIcon from "@mui/icons-material/Info";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import RestoreIcon from "@mui/icons-material/Restore";

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
  EXPERIENCES_DRAWER_MORE_BUTTON: `experiences-drawer-more-button-${uniqueId}`,
  EXPERIENCES_DRAWER_RESTORE_TO_ORIGINAL_BUTTON: `experiences-drawer-restore-to-original-button-${uniqueId}`,
  RESTORE_EXPERIENCE_BUTTON: `restore-experience-button-${uniqueId}`,
};

export const MENU_ITEM_ID = {
  EDIT: `experiences-drawer-menu-item-edit-${uniqueId}`,
  DELETE: `experiences-drawer-menu-item-delete-${uniqueId}`,
  RESTORE_TO_ORIGINAL: `experiences-drawer-menu-item-restore-to-original-${uniqueId}`,
};

export const MENU_ITEM_TEXT = {
  EDIT: "Edit",
  DELETE: "Delete",
  REVERT: "Revert",
};

interface ExperienceProps {
  experience: Experience;
  onEdit?: (experience: Experience) => void;
  onDelete?: (experience: Experience) => void;
  onRestoreToOriginal?: (experience: Experience) => void;
}

export const capitalizeFirstLetter = (string: string): string => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const ExperiencesDrawerContent: React.FC<ExperienceProps> = ({ experience, onEdit, onDelete, onRestoreToOriginal }) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const [skillDescription, setSkillDescription] = React.useState<string>("");
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [moreMenuAnchorEl, setMoreMenuAnchorEl] = React.useState<HTMLElement | null>(null);

  const formattedSkills = useMemo(() => {
    if (experience.top_skills.length === 0) return [];
    return experience.top_skills
  }, [experience.top_skills]);

  const handleEditClick = () => {
    onEdit && onEdit(experience);
    setMoreMenuAnchorEl(null);
  };

  const handleMoreClick = (event: React.MouseEvent<HTMLElement>) => {
    setMoreMenuAnchorEl(event.currentTarget);
  };

  const handleDeleteClick = () => {
    onDelete && onDelete && onDelete(experience);
    setMoreMenuAnchorEl(null);
  };

  const handleRestoreToOriginalClick = () => {
    onRestoreToOriginal && onRestoreToOriginal(experience);
    setMoreMenuAnchorEl(null);
  };

  const isExplored = experience.exploration_phase === DiveInPhase.PROCESSED;

  const getContextMenuHeaderMessage = () => {
    if (!isExplored) {
      return "These actions will become available once you have discussed the experience in detail with Compass.";
    }
    return undefined;
  };

  const getMoreMenuItems = (): MenuItemConfig[] => {
    return [
      {
        id: MENU_ITEM_ID.EDIT,
        text: MENU_ITEM_TEXT.EDIT,
        icon: <EditIcon />,
        disabled: !isExplored,
        action: handleEditClick,
      },
      {
        id: MENU_ITEM_ID.RESTORE_TO_ORIGINAL,
        text: MENU_ITEM_TEXT.REVERT,
        icon: <RestoreIcon />,
        disabled: !isOnline || !isExplored,
        action: handleRestoreToOriginalClick,
      },
      {
        id: MENU_ITEM_ID.DELETE,
        text: MENU_ITEM_TEXT.DELETE,
        icon: <DeleteIcon sx={{ color: theme.palette.error.main }} />,
        disabled: !isOnline || !isExplored,
        action: handleDeleteClick,
        textColor: theme.palette.error.main,
      },
    ];
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
      gap={isSmallMobile ? theme.fixedSpacing(theme.tabiyaSpacing.sm) : theme.fixedSpacing(theme.tabiyaSpacing.md)}
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
          <Box display="flex" alignItems="center" justifyContent="flex-end">
            <PrimaryIconButton
              onClick={handleMoreClick}
              sx={{ color: theme.palette.common.black }}
              title="More options"
              data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_MORE_BUTTON}
            >
              <MoreVertIcon />
            </PrimaryIconButton>
          </Box>
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
          {experience?.company}

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
      <ContextMenu
        anchorEl={moreMenuAnchorEl}
        open={Boolean(moreMenuAnchorEl)}
        notifyOnClose={() => setMoreMenuAnchorEl(null)}
        items={getMoreMenuItems()}
        headerMessage={getContextMenuHeaderMessage()}
      />
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
