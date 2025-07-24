import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Theme } from "@mui/material/styles";
import {
  COMPANY_MAX_LENGTH,
  Experience,
  EXPERIENCE_TITLE_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  Skill,
  SUMMARY_MAX_LENGTH,
  Timeline,
  TIMELINE_MAX_LENGTH,
  UpdateExperienceRequest,
  WorkType,
} from "src/experiences/experienceService/experiences.types";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DeleteIcon from "@mui/icons-material/Delete";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import HelpTip from "src/theme/HelpTip/HelpTip";
import InfoIcon from "@mui/icons-material/Info";
import AddIcon from "@mui/icons-material/Add";
import {
  capitalizeFirstLetter,
} from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import ExperienceService from "src/experiences/experienceService/experienceService";
import { debounce } from "src/utils/debounce";
import {
  checkInitialFieldErrors,
  getExperienceDiff,
  getWorkTypeDescription,
  getWorkTypeIcon,
  getWorkTypeTitle,
} from "src/experiences/experiencesDrawer/util";
import InlineEditField from "src/theme/InlineEditField/InlineEditField";
import SkillsContextMenu
  from "src/experiences/experiencesDrawer/components/experienceEditForm/components/skillsContextMenu/SkillsContextMenu";
import SummaryEditField
  from "src/experiences/experiencesDrawer/components/experienceEditForm/components/SummaryEditField/SummaryEditField";
import { ExperienceError } from "src/error/commonErrors";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";

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
  FORM_SUMMARY_ERROR: `experience-edit-form-summary-error-${uniqueId}`,
  FORM_SKILLS_CONTAINER: `experience-edit-form-skills-container-${uniqueId}`,
  FORM_WORK_TYPE: `experience-edit-form-work-type-title-${uniqueId}`,
  FORM_WORK_TYPE_DROPDOWN: `experience-edit-form-work-type-dropdown-${uniqueId}`,
  FORM_SKILL_CHIP: `experience-edit-form-skill-chip-${uniqueId}`,
  FORM_SKILL_CHIP_DROPDOWN: `experience-edit-form-skill-chip-dropdown-${uniqueId}`,
  FORM_SKILL_CHIP_DELETE_ICON: `experience-edit-form-skill-chip-delete-icon-${uniqueId}`,
  FORM_SKILL_CHIP_UNDO_ICON: `experience-edit-form-skill-chip-undo-icon-${uniqueId}`,
  FORM_ADD_SKILL_BUTTON: `experience-edit-form-add-skill-button-${uniqueId}`,
};

interface ExperienceEditFormProps {
  experience: Experience;
  notifyOnSave: (updatedExperience: Experience) => void;
  notifyOnCancel: () => void;
  notifyOnUnsavedChange?: (hasChanges: boolean) => void;
}

// Extend the Skill type to include a 'deleted' property for soft deletion on the client.
type DeletableSkill = Skill & {
  deleted: boolean
}

type FormValues = Omit<Experience, "top_skills"> & {
  top_skills: DeletableSkill[];
}

// Debounce delay for error checking (ms)
export const DEBOUNCE_ERROR_DELAY_MS = 20;

const ExperienceEditForm: React.FC<ExperienceEditFormProps> = ({
  experience,
  notifyOnSave,
  notifyOnCancel,
  notifyOnUnsavedChange,
}) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  const [formValues, setFormValues] = useState<FormValues>({ ...experience, top_skills: experience.top_skills.map((skill) => ({ ...skill, deleted: false })) });
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [workTypeMenuAnchorEl, setWorkTypeMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const topSkillsRef = useRef<HTMLDivElement>(null);
  const [addSkillMenuAnchorEl, setAddSkillMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [remainingSkills, setRemainingSkills] = useState<Skill[]>([]);

  // Initialize remaining skills
  useEffect(() => {
    if (experience.remaining_skills && Array.isArray(experience.remaining_skills)) {
      setRemainingSkills(experience.remaining_skills);
    }
  }, [experience.remaining_skills]);

  const getFieldError = (value: string, maxLength: number): string | null => {
    return value.length > maxLength ? `Maximum ${maxLength} characters allowed.` : null;
  };

  const updateFieldError = debounce((field: string, value: string, maxLength: number) => {
    setFieldErrors((prevErrors) => {
      const error = getFieldError(value, maxLength);

      if (error) {
        return { ...prevErrors, [field]: error };
      }

      // Remove error if it's resolved
      const { [field]: _, ...rest } = prevErrors;
      return rest;
    });
  }, DEBOUNCE_ERROR_DELAY_MS);

  const debouncedUpdateFieldError = useRef(updateFieldError).current;

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

  // Calculate if there are any changes
  const hasUnsavedChanges = useMemo(() => {
    const newExperience: Experience = {
      ...formValues,
      top_skills: formValues.top_skills.filter((skill) => !skill.deleted)
    }

    return getExperienceDiff(experience, newExperience) !== null;
  }, [formValues, experience]);

  // Notify parent of unsaved changes
  useEffect(() => {
    notifyOnUnsavedChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, notifyOnUnsavedChange]);

  const anyFieldTooLong = Object.keys(fieldErrors).length > 0;

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>, field: keyof Experience, maxLength?: number) => {
      const value = event.target.value;
      setFormValues((prev) => ({
        ...prev,
        [field]: value,
      }));

      if (maxLength !== undefined) {
        debouncedUpdateFieldError(field, value, maxLength);
      }
    },
    [debouncedUpdateFieldError]
  );

  const handleTimelineChange = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
    field: keyof Timeline
  ) => {
    setFormValues((prev) => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        [field]: event.target.value,
      },
    }));
    debouncedUpdateFieldError(`timeline_${field}`, event.target.value, TIMELINE_MAX_LENGTH);
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
      setFormValues((prev) => {
        const currentSkills = prev.top_skills;
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
    }
    handleSkillMenuClose();
  };

  // Toggle the 'deleted' property directly on the skill
  const toggleSkillDeletion = (skillId: string) => {
    setFormValues((prev) => ({
      ...prev,
      top_skills: prev.top_skills.map((skill) =>
        skill.UUID === skillId ? { ...skill, deleted: !skill.deleted } : skill
      ),
    }));
  };

  const getSkillMenuItems = (skillId: string): MenuItemConfig[] => {
    const skill = formValues.top_skills.find((s) => s.UUID === skillId);
    if (!skill) return [];
    return (skill.altLabels || []).map((altLabel) => ({
      id: altLabel,
      text: altLabel.charAt(0).toUpperCase() + altLabel.slice(1),
      disabled: false,
      action: () => handleSkillSelect(altLabel),
    }));
  };

  const handleSave = async () => {
    const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
    if (!sessionId) {
      throw new Error("User has no sessions");
    }

    // Create a diff of the experience to check for changes
    const newExperience: Experience = {
      ...formValues,
      top_skills: formValues.top_skills.filter((skill) => !skill.deleted)
    }

    const changes = getExperienceDiff(experience, newExperience);

    // If no changes detected, don't submit
    if (!changes) return;

    setIsSubmitting(true);

    try {
      const experienceService = ExperienceService.getInstance();
      const updateExperienceRequest: UpdateExperienceRequest = {
        ...changes,
        top_skills: formValues.top_skills.filter(skill => !skill.deleted).map((skill) => ({
          UUID: skill.UUID,
          preferredLabel: skill.preferredLabel,
        }))
      };

      const result = await experienceService.updateExperience(sessionId, experience.UUID, updateExperienceRequest);

      notifyOnSave(result);
      enqueueSnackbar("Experience updated successfully!", { variant: "success" });
    } catch (error) {
      console.error(new ExperienceError("Failed to update experience:", error));
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
    setFormValues((prev) => ({
      ...prev,
      work_type: workType,
    }));

    handleWorkTypeMenuClose();
  };

  const handleAddSkillMenuClick = (event: React.MouseEvent<HTMLDivElement>) => {
    setAddSkillMenuAnchorEl(event.currentTarget);
  };

  const handleAddSkill = (skillId: string) => {
    setFormValues((prev) => {
      const currentSkills = prev.top_skills;

      const remainingSkill = remainingSkills.find((skill) => skill.UUID === skillId);
      if (!remainingSkill) {
        return prev;
      }

      // Remove the skill from remaining skills
      setRemainingSkills(remainingSkills.filter((skill) => skill.UUID !== skillId));

      // Convert RemainingSkill to Skill by adding the deleted property
      const newSkill: DeletableSkill = {
        UUID: remainingSkill.UUID,
        preferredLabel: remainingSkill.preferredLabel,
        description: remainingSkill.description,
        altLabels: remainingSkill.altLabels,
        deleted: false
      };

      // Add the new skill to the top skills
      return {
        ...prev,
        top_skills: [...currentSkills, newSkill],
      };
    });

    notifyOnUnsavedChange?.(true);
    setAddSkillMenuAnchorEl(null);
  };

  const getAddSkillMenuItems = (): MenuItemConfig[] => {
    // Get current skills to filter out
    const currentSkillLabels = (formValues.top_skills || [])
      .map((skill) => skill.preferredLabel.toLowerCase());

    // Filter out skills that already exist
    return remainingSkills
      .filter((skill) => !currentSkillLabels.includes(skill.preferredLabel.toLowerCase()))
      .map((skill) => ({
        id: skill.UUID,
        text: capitalizeFirstLetter(skill.preferredLabel),
        description: skill.description,
        disabled: false,
        action: () => handleAddSkill(skill.UUID),
      }));
  };

  const getWorkTypeMenuItems = (): MenuItemConfig[] => {
    // Only include 'Uncategorized' if the current work_type is null
    const workTypes = formValues.work_type === null ? [...Object.values(WorkType), null] : [...Object.values(WorkType)];
    return workTypes.map((workType) => ({
      id: workType ?? "uncategorized",
      text: getWorkTypeTitle(workType),
      description: getWorkTypeDescription(workType),
      icon: getWorkTypeIcon(workType),
      disabled: false,
      action: () => handleWorkTypeSelect(workType),
    }));
  };

  const isExperienceTitleEmpty = formValues.experience_title === "";

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
            Cancel
          </SecondaryButton>
          <PrimaryButton
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isExperienceTitleEmpty || anyFieldTooLong}
            disableWhenOffline
            data-testid={DATA_TEST_ID.FORM_SAVE_BUTTON}
          >
            Save
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
              {React.cloneElement(getWorkTypeIcon(formValues.work_type), {
                sx: { color: theme.palette.text.secondary },
              })}
              <Typography variant="body1" fontWeight="bold" color={theme.palette.text.secondary}>
                {getWorkTypeTitle(formValues.work_type)}
              </Typography>
            </Box>
            <ArrowDropDownIcon
              sx={{ color: theme.palette.text.secondary }}
              data-testid={DATA_TEST_ID.FORM_WORK_TYPE_DROPDOWN}
            />
          </Box>
          <Box display="flex" flexDirection="column" alignItems="flex-start">
            <InlineEditField
              placeholder="Experience title"
              value={formValues.experience_title}
              onChange={(event) => handleInputChange(event, "experience_title", EXPERIENCE_TITLE_MAX_LENGTH)}
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
              <InlineEditField
                placeholder="Start date"
                value={formValues.timeline.start}
                onChange={(event) => handleTimelineChange(event, "start")}
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
              <InlineEditField
                placeholder="End date"
                value={formValues.timeline.end}
                onChange={(event) => handleTimelineChange(event, "end")}
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
              <InlineEditField
                placeholder="Company"
                value={formValues.company}
                onChange={(event) => handleInputChange(event, "company", COMPANY_MAX_LENGTH)}
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
              <InlineEditField
                placeholder="Location"
                value={formValues.location}
                onChange={(event) => handleInputChange(event, "location", LOCATION_MAX_LENGTH)}
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
          <SummaryEditField
            notifyOnChange={(event) => handleInputChange(event, "summary", SUMMARY_MAX_LENGTH)}
            summary={formValues.summary ?? ""}
            error={fieldErrors.summary}
            experience_uuid={formValues.UUID}
          />
          <Box display="flex" alignItems="center">
            <Typography variant="body1" sx={{ wordBreak: "break-all" }}>
              <b>Top Skills</b>
            </Typography>
            <HelpTip icon={<InfoIcon />}>
              Click the dropdown to change the skill label, or use the delete icon to remove it. Deleted skills can be
              restored with the restore icon. Use the add Skill button to add more.
            </HelpTip>
          </Box>
          <Box
            ref={topSkillsRef}
            display="flex"
            flexWrap="wrap"
            gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
            data-testid={DATA_TEST_ID.FORM_SKILLS_CONTAINER}
          >
            {(formValues.top_skills ?? []).map((skill) => (
              <Chip
                key={skill.UUID}
                data-testid={DATA_TEST_ID.FORM_SKILL_CHIP}
                label={
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <span
                      style={{
                        textDecoration: skill.deleted ? "line-through" : "none",
                        color: skill.deleted ? theme.palette.text.disabled : "inherit",
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
                    {skill.deleted ? (
                      <Box
                        component="span"
                        onClick={() => toggleSkillDeletion(skill.UUID)}
                        data-testid={DATA_TEST_ID.FORM_SKILL_CHIP_UNDO_ICON}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <img
                          src={`${process.env.PUBLIC_URL}/restore-icon.svg`}
                          alt="Restore"
                          // xl wasn't quite big enough, we're going for ~16px
                          style={{ width: theme.tabiyaSpacing.xl * 4, height: theme.tabiyaSpacing.xl * 4 }}
                        />
                      </Box>
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
            <Chip
              icon={
                <AddIcon
                  sx={{ fontSize: theme.tabiyaSpacing.xl * 5 }} // MUI's default icon sizes are either too small or too large for this specific icon, so we use a custom size (~20px)
                />
              }
              label={"Add skill"}
              onClick={handleAddSkillMenuClick}
              data-testid={DATA_TEST_ID.FORM_ADD_SKILL_BUTTON}
              disabled={getAddSkillMenuItems().length === 0 || !isOnline}
              sx={{
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.common.black,
                "&:hover": {
                  backgroundColor: theme.palette.primary.dark,
                },
                ".MuiChip-icon": {
                  color: theme.palette.common.black,
                },
                "&.Mui-disabled": {
                  backgroundColor: theme.palette.grey[400],
                  color: theme.palette.text.disabled,
                },
              }}
            />
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
      <SkillsContextMenu
        anchorEl={addSkillMenuAnchorEl}
        open={Boolean(addSkillMenuAnchorEl)}
        notifyOnClose={() => setAddSkillMenuAnchorEl(null)}
        items={getAddSkillMenuItems()}
      />
      <Backdrop isShown={isSubmitting} message="Updating experience..." />
    </Box>
  );
};

export default ExperienceEditForm;
