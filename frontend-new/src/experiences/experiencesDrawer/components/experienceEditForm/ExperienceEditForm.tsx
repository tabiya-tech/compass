import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, styled, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Theme } from "@mui/material/styles";
import {
  Experience,
  Timeline,
  WorkType,
  UpdateExperienceRequest,
  EXPERIENCE_TITLE_MAX_LENGTH,
  COMPANY_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  SUMMARY_MAX_LENGTH,
  TIMELINE_MAX_LENGTH,
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
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import ExperienceService from "src/experiences/experienceService/experienceService";
import { debounce } from "src/utils/debounce";
import { getWorkTypeDescription, getWorkTypeIcon, getWorkTypeTitle } from "src/experiences/experiencesDrawer/util";

const uniqueId = "0ddc6b92-eca6-472b-8e5f-fdce9abfec3b";

export const DATA_TEST_ID = {
  FORM_CONTAINER: `experience-edit-form-container-${uniqueId}`,
  FORM_SAVE_BUTTON: `experience-edit-form-save-button-${uniqueId}`,
  FORM_CANCEL_BUTTON: `experience-edit-form-cancel-button-${uniqueId}`,
  FORM_EXPERIENCE_TITLE: `experience-edit-form-experience-title-${uniqueId}`,
  FORM_EXPERIENCE_TITLE_ERROR: `experience-edit-form-experience-title-error-${uniqueId}`,
  FORM_START_DATE: `experience-edit-form-start-date-${uniqueId}`,
  FORM_END_DATE: `experience-edit-form-end-date-${uniqueId}`,
  FORM_COMPANY: `experience-edit-form-company-${uniqueId}`,
  FORM_COMPANY_ERROR: `experience-edit-form-company-error-${uniqueId}`,
  FORM_LOCATION: `experience-edit-form-location-${uniqueId}`,
  FORM_LOCATION_ERROR: `experience-edit-form-location-error-${uniqueId}`,
  FORM_SUMMARY: `experience-edit-form-summary-${uniqueId}`,
  FORM_SUMMARY_ERROR: `experience-edit-form-summary-error-${uniqueId}`,
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
  borderRadius: theme.fixedSpacing(theme.tabiyaRounding.sm),
  padding: theme.fixedSpacing(theme.tabiyaSpacing.xs),
}));
// Debounce delay for error checking (ms)
export const DEBOUNCE_ERROR_DELAY_MS = 20;

const checkInitialFieldErrors = (experience: Experience) => {
  const errors: { [key: string]: string } = {};
  if (experience.experience_title && experience.experience_title.length > EXPERIENCE_TITLE_MAX_LENGTH) {
    errors.experience_title = `Maximum ${EXPERIENCE_TITLE_MAX_LENGTH} characters allowed.`;
  }
  if (experience.company && experience.company.length > COMPANY_MAX_LENGTH) {
    errors.company = `Maximum ${COMPANY_MAX_LENGTH} characters allowed.`;
  }
  if (experience.location && experience.location.length > LOCATION_MAX_LENGTH) {
    errors.location = `Maximum ${LOCATION_MAX_LENGTH} characters allowed.`;
  }
  if (experience.summary && experience.summary.length > SUMMARY_MAX_LENGTH) {
    errors.summary = `Maximum ${SUMMARY_MAX_LENGTH} characters allowed.`;
  }
  if (experience.timeline.start && experience.timeline.start.length > TIMELINE_MAX_LENGTH) {
    errors.timeline_start = `Maximum ${TIMELINE_MAX_LENGTH} characters allowed.`;
  }
  if (experience.timeline.end && experience.timeline.end.length > TIMELINE_MAX_LENGTH) {
    errors.timeline_end = `Maximum ${TIMELINE_MAX_LENGTH} characters allowed.`;
  }
  return errors;
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
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [workTypeMenuAnchorEl, setWorkTypeMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Debounced error updater (stable ref)
  const debouncedUpdateFieldError = useRef(
    debounce((field: string, value: string, maxLength: number) => {
      setFieldErrors((prev) => {
        if (value.length > maxLength) {
          return { ...prev, [field]: `Maximum ${maxLength} characters allowed.` };
        } else {
          const { [field]: _, ...rest } = prev;
          return rest;
        }
      });
    }, DEBOUNCE_ERROR_DELAY_MS)
  ).current;

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      debouncedUpdateFieldError.cancel();
    };
  }, [debouncedUpdateFieldError]);

  // Set initial errors on mount and when experience prop changes
  useEffect(() => {
    setFieldErrors(checkInitialFieldErrors(experience));
  }, [experience]);

  const displayExperience = useMemo(() => ({ ...experience, ...editedExperience }), [experience, editedExperience]);

  const hasChanges = useMemo(
    () => Object.keys(editedExperience).length > 0 || markedForDeletion.size > 0,
    [editedExperience, markedForDeletion]
  );

  const anyFieldTooLong = Object.keys(fieldErrors).length > 0;

  useEffect(() => {
    notifyOnUnsavedChange?.(hasChanges);
  }, [hasChanges, notifyOnUnsavedChange]);

  const handleInputChange =
    (field: keyof Experience, maxLength?: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      let value = event.target.value;
      setEditedExperience((prev) => ({
        ...prev,
        [field]: value,
      }));
      if (maxLength !== undefined) {
        debouncedUpdateFieldError(field, value, maxLength);
      }
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
    debouncedUpdateFieldError(`timeline_${field}`, event.target.value, TIMELINE_MAX_LENGTH);
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
        const currentSkills = prev.top_skills || [...experience.top_skills];

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

      const updatedFields: UpdateExperienceRequest = Object.fromEntries(
        Object.entries(editedExperience).filter(([key, value]) => value !== undefined && key !== "top_skills")
      ) as UpdateExperienceRequest;

      if (markedForDeletion.size > 0 || (editedExperience.top_skills && editedExperience.top_skills.length > 0)) {
        const baseSkills = editedExperience.top_skills || experience.top_skills;
        updatedFields.top_skills = baseSkills
          .filter((skill) => !markedForDeletion.has(skill.UUID))
          .map((skill) => ({
            UUID: skill.UUID,
            preferredLabel: skill.preferredLabel,
          }));
      }

      const experienceService = ExperienceService.getInstance();
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

  const handleWorkTypeMenuClick = (event: React.MouseEvent<HTMLDivElement>) => {
    setWorkTypeMenuAnchorEl(event.currentTarget);
  };

  const handleWorkTypeMenuClose = () => {
    setWorkTypeMenuAnchorEl(null);
  };

  const handleWorkTypeSelect = (workType: WorkType | null) => {
    setEditedExperience((prev) => ({
      ...prev,
      work_type: workType,
    }));

    notifyOnUnsavedChange?.(true);
    handleWorkTypeMenuClose();
  };

  const getWorkTypeMenuItems = (): MenuItemConfig[] => {
    // Only include 'Uncategorized' if the current work_type is null
    const workTypes =
      displayExperience.work_type === null ? [...Object.values(WorkType), null] : [...Object.values(WorkType)];
    return workTypes.map((workType) => ({
      id: workType ?? "uncategorized",
      text: getWorkTypeTitle(workType),
      description: getWorkTypeDescription(workType),
      icon: getWorkTypeIcon(workType),
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
            disabled={!hasChanges || isExperienceTitleEmpty || anyFieldTooLong}
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
        <Box display="flex" alignItems="center">
          <Typography variant="body1" sx={{ wordBreak: "break-all" }}>
            <b>Experience info</b>
          </Typography>
          <HelpTip icon={<InfoIcon />}>
            Click a field to update the work type, title, dates, company, location, or summary of your experience.
          </HelpTip>
        </Box>
        <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
          <Box
            display="flex"
            justifyItems="start"
            onClick={handleWorkTypeMenuClick}
            sx={{
              backgroundColor: theme.palette.grey[100],
              borderRadius: theme.fixedSpacing(theme.tabiyaRounding.sm),
              padding: theme.fixedSpacing(theme.tabiyaSpacing.xs),
              paddingX: theme.fixedSpacing(theme.tabiyaSpacing.sm),
              cursor: "pointer",
              width: "fit-content",
            }}
            data-testid={DATA_TEST_ID.FORM_WORK_TYPE}
          >
            <Box display="flex" alignItems="center" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
              {React.cloneElement(getWorkTypeIcon(displayExperience.work_type), {
                sx: { color: theme.palette.text.secondary },
              })}
              <Typography variant="body1" fontWeight="bold" color={theme.palette.text.secondary}>
                {getWorkTypeTitle(displayExperience.work_type)}
              </Typography>
            </Box>
            <ArrowDropDownIcon
              sx={{ color: theme.palette.text.secondary }}
              data-testid={DATA_TEST_ID.FORM_WORK_TYPE_DROPDOWN}
            />
          </Box>
          <Box display="flex" flexDirection="column" alignItems="flex-start">
            <StyledTextField
              placeholder="Experience title"
              value={displayExperience.experience_title}
              onChange={handleInputChange("experience_title", EXPERIENCE_TITLE_MAX_LENGTH)}
              autoFocus
              data-testid={DATA_TEST_ID.FORM_EXPERIENCE_TITLE}
              sx={{
                "& .MuiInputBase-input": {
                  fontWeight: "bold",
                  fontSize: theme.typography.body1.fontSize,
                },
              }}
              error={!!fieldErrors.experience_title}
            />
            {fieldErrors.experience_title && (
              <Typography
                variant="caption"
                sx={{ color: theme.palette.error.main, width: "100%" }}
                data-testid={DATA_TEST_ID.FORM_EXPERIENCE_TITLE_ERROR}
              >
                {fieldErrors.experience_title}
              </Typography>
            )}
            {isExperienceTitleEmpty && (
              <Typography variant="caption" color={theme.palette.error.main}>
                * Experience title is required
              </Typography>
            )}
          </Box>
          <Box display="flex" justifyContent="space-between" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <Box flexGrow={1}>
              <StyledTextField
                placeholder="Start date"
                value={displayExperience.timeline.start}
                onChange={handleTimelineChange("start")}
                data-testid={DATA_TEST_ID.FORM_START_DATE}
                error={!!fieldErrors.timeline_start}
              />
              {fieldErrors.timeline_start && (
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.error.main, width: "100%", textAlign: "end" }}
                  data-testid={DATA_TEST_ID.FORM_COMPANY_ERROR}
                >
                  {fieldErrors.timeline_start}
                </Typography>
              )}
            </Box>
            <Box flexGrow={1}>
              <StyledTextField
                placeholder="End date"
                value={displayExperience.timeline.end}
                onChange={handleTimelineChange("end")}
                data-testid={DATA_TEST_ID.FORM_END_DATE}
                error={!!fieldErrors.timeline_end}
              />
              {fieldErrors.timeline_end && (
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.error.main, width: "100%", textAlign: "end" }}
                  data-testid={DATA_TEST_ID.FORM_COMPANY_ERROR}
                >
                  {fieldErrors.timeline_end}
                </Typography>
              )}
            </Box>
          </Box>
          <Box display="flex" justifyContent="space-between" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <Box width="100%">
              <StyledTextField
                placeholder="Company"
                value={displayExperience.company}
                onChange={handleInputChange("company", COMPANY_MAX_LENGTH)}
                data-testid={DATA_TEST_ID.FORM_COMPANY}
                error={!!fieldErrors.company}
              />
              {fieldErrors.company && (
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.error.main, width: "100%", textAlign: "end" }}
                  data-testid={DATA_TEST_ID.FORM_COMPANY_ERROR}
                >
                  {fieldErrors.company}
                </Typography>
              )}
            </Box>
            <Box width="100%">
              <StyledTextField
                placeholder="Location"
                value={displayExperience.location}
                onChange={handleInputChange("location", LOCATION_MAX_LENGTH)}
                data-testid={DATA_TEST_ID.FORM_LOCATION}
                error={!!fieldErrors.location}
              />
              {fieldErrors.location && (
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.error.main, width: "100%", textAlign: "end" }}
                  data-testid={DATA_TEST_ID.FORM_LOCATION_ERROR}
                >
                  {fieldErrors.location}
                </Typography>
              )}
            </Box>
          </Box>
          <Box width="100%">
            <StyledTextField
              placeholder="Experience summary"
              value={displayExperience.summary ?? ""}
              onChange={handleInputChange("summary", SUMMARY_MAX_LENGTH)}
              multiline
              minRows={4}
              sx={{ paddingY: theme.fixedSpacing(theme.tabiyaSpacing.sm) }}
              data-testid={DATA_TEST_ID.FORM_SUMMARY}
              error={!!fieldErrors.summary}
            />
            {fieldErrors.summary && (
              <Typography
                variant="caption"
                sx={{ color: theme.palette.error.main, width: "100%", textAlign: "end" }}
                data-testid={DATA_TEST_ID.FORM_SUMMARY_ERROR}
              >
                {fieldErrors.summary}
              </Typography>
            )}
          </Box>
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
