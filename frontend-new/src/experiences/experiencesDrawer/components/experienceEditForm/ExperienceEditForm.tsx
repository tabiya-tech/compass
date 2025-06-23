import React, { useEffect, useMemo, useState } from "react";
import { Box, Chip, styled, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Theme } from "@mui/material/styles";
import {
  Experience,
  Timeline,
  WorkType,
  UpdateExperienceRequest,
} from "src/experiences/experienceService/experiences.types";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import UndoIcon from "@mui/icons-material/Undo";
import DeleteIcon from "@mui/icons-material/Delete";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import HelpTip from "src/theme/HelpTip/HelpTip";
import InfoIcon from "@mui/icons-material/Info";
import { capitalizeFirstLetter } from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { ReportContent } from "src/experiences/report/reportContent";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import ExperienceService from "src/experiences/experienceService/experienceService";

const uniqueId = "0ddc6b92-eca6-472b-8e5f-fdce9abfec3b";

export const DATA_TEST_ID = {
  FORM_CONTAINER: `experience-edit-form-container-${uniqueId}`,
  FORM_SAVE_BUTTON: `experience-edit-form-save-button-${uniqueId}`,
  FORM_CANCEL_BUTTON: `experience-edit-form-cancel-button-${uniqueId}`,
  FORM_EXPERIENCE_TITLE: `experience-edit-form-experience-title-${uniqueId}`,
  FORM_START_DATE: `experience-edit-form-start-date-${uniqueId}`,
  FORM_END_DATE: `experience-edit-form-end-date-${uniqueId}`,
  FORM_COMPANY: `experience-edit-form-company-${uniqueId}`,
  FORM_LOCATION: `experience-edit-form-location-${uniqueId}`,
  FORM_SUMMARY: `experience-edit-form-summary-${uniqueId}`,
  FORM_SKILLS_CONTAINER: `experience-edit-form-skills-container-${uniqueId}`,
  FORM_WORK_TYPE: `experience-edit-form-work-type-title-${uniqueId}`,
  FORM_WORK_TYPE_DROPDOWN: `experience-edit-form-work-type-dropdown-${uniqueId}`,
  FORM_SKILL_CHIP: `experience-edit-form-skill-chip-${uniqueId}`,
  FORM_SKILL_CHIP_DROPDOWN: `experience-edit-form-skill-chip-dropdown-${uniqueId}`,
  FORM_SKILL_CHIP_DELETE_ICON: `experience-edit-form-skill-chip-delete-icon-${uniqueId}`,
  FORM_SKILL_CHIP_UNDO_ICON: `experience-edit-form-skill-chip-undo-icon-${uniqueId}`,
};

interface ExperienceEditFormProps {
  experience: Experience;
  notifyOnSave: (updatedExperience: Experience) => void;
  notifyOnCancel: () => void;
  notifyOnUnsavedChange?: (hasChanges: boolean) => void;
}

const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      border: "none",
    },
    padding: 0,
  },
  "& .MuiInputBase-input": {
    padding: 0,
    paddingLeft: theme.fixedSpacing(theme.tabiyaSpacing.sm),
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
    background: "transparent !important",
  },
  width: "100%",
  backgroundColor: theme.palette.grey[100],
  borderRadius: theme.fixedSpacing(theme.tabiyaRounding.md),
  padding: theme.fixedSpacing(theme.tabiyaSpacing.xs),
}));

const workTypeTitle = (workType: WorkType | null) => {
  switch (workType) {
    case WorkType.SELF_EMPLOYMENT:
      return ReportContent.SELF_EMPLOYMENT_TITLE;
    case WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT:
      return ReportContent.SALARY_WORK_TITLE;
    case WorkType.UNSEEN_UNPAID:
      return ReportContent.UNPAID_WORK_TITLE;
    case WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK:
      return ReportContent.TRAINEE_WORK_TITLE;
    default:
      return ReportContent.UNCATEGORIZED_TITLE;
  }
};

const workTypeDescription = (workType: WorkType | null) => {
  switch (workType) {
    case WorkType.SELF_EMPLOYMENT:
      return "You work for yourself and run your own business";
    case WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT:
      return "You have a regular paid job with an employer";
    case WorkType.UNSEEN_UNPAID:
      return "You work without pay to learn or gain experience";
    case WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK:
      return "You help out without pay, like volunteering or community service";
    default:
      return "Work that doesn't fit into the other categories";
  }
};

const ExperienceEditForm: React.FC<ExperienceEditFormProps> = ({
  experience,
  notifyOnSave,
  notifyOnCancel,
  notifyOnUnsavedChange,
}) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  const [editedExperience, setEditedExperience] = useState<Partial<Experience>>({});
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [markedForDeletion, setMarkedForDeletion] = useState<Set<string>>(new Set());
  const [workTypeMenuAnchorEl, setWorkTypeMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const displayExperience = useMemo(() => ({ ...experience, ...editedExperience }), [experience, editedExperience]);

  // Check if there are any changes that need to be saved
  const hasChanges = useMemo(
    () => Object.keys(editedExperience).length > 0 || markedForDeletion.size > 0,
    [editedExperience, markedForDeletion]
  );

  useEffect(() => {
    notifyOnUnsavedChange?.(hasChanges);
  }, [hasChanges, notifyOnUnsavedChange]);

  const handleInputChange = (field: keyof Experience) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditedExperience((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));

    notifyOnUnsavedChange?.(true);
  };

  const handleTimelineChange = (field: keyof Timeline) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditedExperience((prev) => ({
      ...prev,
      timeline: {
        ...(prev.timeline || experience.timeline),
        [field]: event.target.value,
      },
    }));

    notifyOnUnsavedChange?.(true);
  };

  const handleSkillMenuClick = (event: React.MouseEvent<HTMLElement | SVGSVGElement>, skillId: string) => {
    setMenuAnchorEl(event.currentTarget as HTMLElement);
    setSelectedSkillId(skillId);
  };

  const handleSkillMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedSkillId(null);
  };

  const handleSkillSelect = (newPreferredLabel: string) => {
    if (selectedSkillId) {
      setEditedExperience((prev) => {
        // Get the current skills, either from previous edit or original experience
        const currentSkills = prev.top_skills || [...experience.top_skills];

        // Create a new array with updated skills
        const updatedSkills = currentSkills.map((skill) => {
          if (skill.UUID === selectedSkillId) {
            return {
              ...skill,
              preferredLabel: newPreferredLabel,
            };
          }
          return skill;
        });

        return {
          ...prev,
          top_skills: updatedSkills,
        };
      });

      notifyOnUnsavedChange?.(true);
    }
    handleSkillMenuClose();
  };

  const toggleSkillDeletion = (skillId: string) => {
    setMarkedForDeletion((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(skillId)) {
        newSet.delete(skillId);
      } else {
        newSet.add(skillId);
      }
      return newSet;
    });
  };

  const getSkillMenuItems = (skillId: string): MenuItemConfig[] => {
    const skill = displayExperience.top_skills.find((s) => s.UUID === skillId);
    if (!skill) return [];

    return (skill.altLabels || []).map((altLabel) => ({
      id: altLabel,
      text: altLabel.charAt(0).toUpperCase() + altLabel.slice(1),
      disabled: false,
      action: () => handleSkillSelect(altLabel),
    }));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const userPreferences = UserPreferencesStateService.getInstance().getUserPreferences();
      if (!userPreferences?.sessions.length) {
        throw new Error("User has no sessions");
      }

      const sessionId = userPreferences.sessions[0];

      // Extract only defined fields from editedExperience (excluding top_skills)
      const updatedFields: UpdateExperienceRequest = Object.fromEntries(
        Object.entries(editedExperience).filter(([key, value]) => value !== undefined && key !== "top_skills")
      ) as UpdateExperienceRequest;

      // Handle skills filtering separately
      if (markedForDeletion.size > 0 || (editedExperience.top_skills && editedExperience.top_skills.length > 0)) {
        const baseSkills = editedExperience.top_skills || experience.top_skills;
        updatedFields.top_skills = baseSkills
          .filter((skill) => !markedForDeletion.has(skill.UUID))
          .map((skill) => ({
            UUID: skill.UUID,
            preferredLabel: skill.preferredLabel,
          }));
      }

      const experienceService = new ExperienceService();
      const result = await experienceService.updateExperience(sessionId, experience.UUID, updatedFields);

      notifyOnUnsavedChange?.(false);
      notifyOnSave(result);
      enqueueSnackbar("Experience updated successfully!", { variant: "success" });
    } catch (error) {
      console.error("Failed to update experience:", error);
      enqueueSnackbar("Failed to update experience. Please try again later.", { variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWorkTypeMenuClick = (event: React.MouseEvent<SVGSVGElement>) => {
    setWorkTypeMenuAnchorEl(event.currentTarget as unknown as HTMLElement);
  };

  const handleWorkTypeMenuClose = () => {
    setWorkTypeMenuAnchorEl(null);
  };

  const handleWorkTypeSelect = (workType: WorkType | null) => {
    setEditedExperience((prev) => ({
      ...prev,
      work_type: workType,
    }));
    handleWorkTypeMenuClose();
  };

  const getWorkTypeMenuItems = (): MenuItemConfig[] => {
    const workTypes = [...Object.values(WorkType), null];
    return workTypes.map((workType) => ({
      id: workType ?? "uncategorized",
      text: workTypeTitle(workType),
      description: workTypeDescription(workType),
      disabled: false,
      action: () => handleWorkTypeSelect(workType),
    }));
  };

  const isExperienceTitleEmpty = displayExperience.experience_title === "";

  return (
    <Box
      display="flex"
      flexDirection="column"
      paddingBottom={isSmallMobile ? theme.fixedSpacing(theme.tabiyaSpacing.md) : theme.tabiyaSpacing.xl}
      data-testid={DATA_TEST_ID.FORM_CONTAINER}
    >
      <Box
        display="flex"
        flexDirection="column"
        position="sticky"
        top={0}
        zIndex={1}
        bgcolor={theme.palette.background.paper}
        gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
        padding={isSmallMobile ? theme.fixedSpacing(theme.tabiyaSpacing.md) : theme.tabiyaSpacing.xl}
      >
        <Typography variant="h5">Edit Experience</Typography>
        <Box display="flex" justifyContent="flex-end" gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}>
          <SecondaryButton onClick={notifyOnCancel} data-testid={DATA_TEST_ID.FORM_CANCEL_BUTTON}>
            <Typography variant="caption">Cancel</Typography>
          </SecondaryButton>
          <PrimaryButton
            onClick={handleSave}
            disabled={!hasChanges || isExperienceTitleEmpty}
            disableWhenOffline
            data-testid={DATA_TEST_ID.FORM_SAVE_BUTTON}
          >
            <Typography variant="caption">Save</Typography>
          </PrimaryButton>
        </Box>
      </Box>
      <Box
        display="flex"
        flexDirection="column"
        gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
        paddingX={isSmallMobile ? theme.fixedSpacing(theme.tabiyaSpacing.md) : theme.tabiyaSpacing.xl}
      >
        <Box
          display="flex"
          alignItems="center"
          gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}
          data-testid={DATA_TEST_ID.FORM_WORK_TYPE}
        >
          <HelpTip icon={<InfoIcon />}>Choose the work category that best reflects what you've done</HelpTip>
          <Typography variant="subtitle1" fontWeight="bold" color={theme.palette.text.secondary}>
            {workTypeTitle(displayExperience.work_type)}
          </Typography>
          <ArrowDropDownIcon
            sx={{
              fontSize: "30px",
              cursor: "pointer",
              color: theme.palette.text.secondary,
            }}
            onClick={handleWorkTypeMenuClick}
            data-testid={DATA_TEST_ID.FORM_WORK_TYPE_DROPDOWN}
          />
        </Box>
        <Box display="flex" alignItems="center">
          <Typography variant="body1" sx={{ wordBreak: "break-all" }}>
            <b>Experience info</b>
          </Typography>
          <HelpTip icon={<InfoIcon />}>
            Click a field to update the title, dates, company, location, or summary of your experience.
          </HelpTip>
        </Box>
        <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
          <Box display="flex" flexDirection="column" alignItems="flex-start">
            <StyledTextField
              placeholder="Experience title"
              value={displayExperience.experience_title}
              onChange={handleInputChange("experience_title")}
              autoFocus
              data-testid={DATA_TEST_ID.FORM_EXPERIENCE_TITLE}
              sx={{
                "& .MuiInputBase-input": {
                  fontWeight: "bold",
                  fontSize: theme.typography.body1.fontSize,
                },
              }}
            />
            {isExperienceTitleEmpty && (
              <Typography variant="caption" color={theme.palette.error.main}>
                * Experience title is required
              </Typography>
            )}
          </Box>
          <Box display="flex" justifyContent="space-between" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <StyledTextField
              placeholder="Start date"
              value={displayExperience.timeline.start}
              onChange={handleTimelineChange("start")}
              data-testid={DATA_TEST_ID.FORM_START_DATE}
            />
            <StyledTextField
              placeholder="End date"
              value={displayExperience.timeline.end}
              onChange={handleTimelineChange("end")}
              data-testid={DATA_TEST_ID.FORM_END_DATE}
            />
          </Box>
          <Box display="flex" justifyContent="space-between" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <StyledTextField
              placeholder="Company"
              value={displayExperience.company}
              onChange={handleInputChange("company")}
              data-testid={DATA_TEST_ID.FORM_COMPANY}
            />
            <StyledTextField
              placeholder="Location"
              value={displayExperience.location}
              onChange={handleInputChange("location")}
              data-testid={DATA_TEST_ID.FORM_LOCATION}
            />
          </Box>
          <StyledTextField
            placeholder="Experience summary"
            value={displayExperience.summary ?? ""}
            onChange={handleInputChange("summary")}
            multiline
            minRows={4}
            sx={{ paddingY: theme.fixedSpacing(theme.tabiyaSpacing.sm) }}
            data-testid={DATA_TEST_ID.FORM_SUMMARY}
          />
          <Box display="flex" alignItems="center">
            <Typography variant="body1" sx={{ wordBreak: "break-all" }}>
              <b>Top Skills</b>
            </Typography>
            <HelpTip icon={<InfoIcon />}>
              Click the dropdown to pick another skill label, or use the delete icon to remove it.
            </HelpTip>
          </Box>
          <Box
            display="flex"
            flexWrap="wrap"
            gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
            data-testid={DATA_TEST_ID.FORM_SKILLS_CONTAINER}
          >
            {displayExperience.top_skills.map((skill) => (
              <Chip
                key={skill.UUID}
                data-testid={DATA_TEST_ID.FORM_SKILL_CHIP}
                label={
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <span
                      style={{
                        textDecoration: markedForDeletion.has(skill.UUID) ? "line-through" : "none",
                        color: markedForDeletion.has(skill.UUID) ? theme.palette.text.disabled : "inherit",
                      }}
                    >
                      {capitalizeFirstLetter(skill.preferredLabel)}
                    </span>
                    <ArrowDropDownIcon
                      sx={{
                        fontSize: "30px",
                        marginLeft: 1,
                        cursor: "pointer",
                      }}
                      onClick={(event) => handleSkillMenuClick(event, skill.UUID)}
                      data-testid={DATA_TEST_ID.FORM_SKILL_CHIP_DROPDOWN}
                    />
                    {markedForDeletion.has(skill.UUID) ? (
                      <UndoIcon
                        fontSize="small"
                        sx={{ color: theme.palette.text.secondary, cursor: "pointer" }}
                        onClick={() => toggleSkillDeletion(skill.UUID)}
                        data-testid={DATA_TEST_ID.FORM_SKILL_CHIP_UNDO_ICON}
                      />
                    ) : (
                      <DeleteIcon
                        fontSize="small"
                        sx={{ color: theme.palette.error.main, cursor: "pointer" }}
                        onClick={() => toggleSkillDeletion(skill.UUID)}
                        data-testid={DATA_TEST_ID.FORM_SKILL_CHIP_DELETE_ICON}
                      />
                    )}
                  </Box>
                }
                sx={{ color: theme.palette.text.secondary, backgroundColor: theme.palette.grey[100] }}
              />
            ))}
          </Box>
        </Box>
      </Box>
      <ContextMenu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        notifyOnClose={handleSkillMenuClose}
        items={selectedSkillId ? getSkillMenuItems(selectedSkillId) : []}
      />
      <ContextMenu
        anchorEl={workTypeMenuAnchorEl}
        open={Boolean(workTypeMenuAnchorEl)}
        notifyOnClose={handleWorkTypeMenuClose}
        items={getWorkTypeMenuItems()}
      />
      <Backdrop isShown={isSubmitting} message="Updating experience..." />
    </Box>
  );
};

export default ExperienceEditForm;
