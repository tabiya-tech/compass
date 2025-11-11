import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Box, Divider, Drawer, Skeleton, Slide, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Theme } from "@mui/material/styles";
import ExperiencesDrawerHeader from "src/experiences/experiencesDrawer/components/experiencesDrawerHeader/ExperiencesDrawerHeader";
import { LoadingExperienceDrawerContent } from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import { DiveInPhase, Experience } from "src/experiences/experienceService/experiences.types";
import { StoredPersonalInfo } from "src/sensitiveData/types";
import CustomTextField from "src/theme/CustomTextField/CustomTextField";
import CustomAccordion from "src/theme/CustomAccordion/CustomAccordion";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { groupExperiencesByWorkType } from "src/experiences/report/util";
import { sortSkillsByOrderIndex } from "src/experiences/experiencesDrawer/util";
import { ReportContent } from "src/experiences/report/reportContent";
import StoreIcon from "@mui/icons-material/Store";
import WorkIcon from "@mui/icons-material/Work";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import SchoolIcon from "@mui/icons-material/School";
import QuizIcon from "@mui/icons-material/Quiz";
import ExperienceCategory from "src/experiences/experiencesDrawer/components/experienceCategory/ExperienceCategory";
import ExperienceEditForm from "src/experiences/experiencesDrawer/components/experienceEditForm/ExperienceEditForm";
import { lazyWithPreload } from "src/utils/preloadableComponent/PreloadableComponent";
import ConfirmModalDialog from "src/theme/confirmModalDialog/ConfirmModalDialog";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import ExperienceService from "src/experiences/experienceService/experienceService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import { getUserFriendlyErrorMessage, RestAPIError } from "src/error/restAPIError/RestAPIError";
import CustomLink from "src/theme/CustomLink/CustomLink";
import RestoreExperiencesDrawer from "src/experiences/experiencesDrawer/components/restoreExperiencesDrawer/RestoreExperiencesDrawer";
import { ExperienceError } from "src/error/commonErrors";
import RestoreIcon from "src/theme/Icons/RestoreIcon";
import { useTranslation } from "react-i18next";

const LazyLoadedDownloadDropdown = lazyWithPreload(
  () => import("src/experiences/experiencesDrawer/components/downloadReportDropdown/DownloadReportDropdown")
);

export interface ExperiencesDrawerProps {
  isOpen: boolean;
  notifyOnClose: (event: CloseEvent) => void;
  experiences: Experience[];
  isLoading: boolean;
  conversationConductedAt: string | null;
  onExperiencesUpdated: () => Promise<void>;
}

export enum CloseEventName {
  DISMISS = "DISMISS",
}

export type CloseEvent = { name: CloseEventName };

const uniqueId = "df5ab5c0-a109-4b6d-ba3f-a46975e5511b";

export const DATA_TEST_ID = {
  EXPERIENCES_DRAWER_CONTAINER: `experiences-drawer-container-${uniqueId}`,
  EXPERIENCES_DRAWER_CONTENT_LOADER: `experiences-drawer-content-loader-${uniqueId}`,
  EXPERIENCES_DIVIDER: `experiences-divider-${uniqueId}`,
  UNSAVED_CHANGES_DIALOG: `unsaved-changes-dialog-${uniqueId}`,
  DELETE_EXPERIENCE_DIALOG: `delete-experience-dialog-${uniqueId}`,
  RESTORE_TO_ORIGINAL_CONFIRM_DIALOG: `restore-to-original-confirm-dialog-${uniqueId}`,
  RESTORE_DELETED_EXPERIENCES_LINK: `restore-deleted-experiences-link-${uniqueId}`,
  PERSONAL_INFORMATION_TITLE: `personal-information-title-${uniqueId}`,
};

const useLocalStorage = (key: string, initialValue: Record<string, string>) => {
  // Retrieve value from localStorage or fallback to initialValue
  const [value, setValue] = useState<Record<string, string>>(() => {
    const savedValue = PersistentStorageService.getPersonalInfo();
    const parsedValue = savedValue ?? initialValue;
    return Object.fromEntries(
      Object.entries(parsedValue).map(([fieldName, fieldValue]) => [fieldName, (fieldValue as string).trim() ?? ""])
    );
  });

  useEffect(() => {
    const validatedValue = Object.fromEntries(
      Object.entries(value).map(([fieldName, fieldValue]) => [fieldName, fieldValue.trim() ?? ""])
    );

    PersistentStorageService.setPersonalInfo(validatedValue as unknown as StoredPersonalInfo);
  }, [key, value]);

  return [value, setValue] as const;
};

const ExperiencesDrawer: React.FC<ExperiencesDrawerProps> = ({
  isOpen,
  isLoading,
  experiences,
  notifyOnClose,
  conversationConductedAt,
  onExperiencesUpdated,
}) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const [personalInfo, setPersonalInfo] = useLocalStorage("personalInfo", {
    fullName: "",
    phoneNumber: "",
    contactEmail: "",
    address: "",
  });
  const [editingExperience, setEditingExperience] = useState<Experience | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [experienceToDelete, setExperienceToDelete] = useState<Experience | null>(null);
  const [isDeletingExperience, setIsDeletingExperience] = React.useState(false);
  const [showRestoreDrawer, setShowRestoreDrawer] = useState(false);
  const [isRestoringExperience, setIsRestoringExperience] = useState(false);
  const [showRestoreToOriginalConfirmDialog, setShowRestoreToOriginalConfirmDialog] = React.useState(false);
  const [experienceToRestoreToOriginal, setExperienceToRestoreToOriginal] = React.useState<Experience | null>(null);

  // Sort top and remaining skills by their order index for each experience
  const sortedExperiences = useMemo(() => {
    return experiences.map((exp) => ({
      ...exp,
      top_skills: sortSkillsByOrderIndex(exp.top_skills),
      remaining_skills: sortSkillsByOrderIndex(exp.remaining_skills),
    }));
  }, [experiences]);

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    console.debug("Personal info updated", { field, value: e.target.value });
    setPersonalInfo({ ...personalInfo, [field]: e.target.value });
  };

  const handleClose = () => {
    if (!editingExperience) {
      notifyOnClose({ name: CloseEventName.DISMISS });
      return;
    }

    if (hasUnsavedChanges) {
      setShowConfirmDialog(true);
      return;
    }

    setEditingExperience(null);
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    if (editingExperience) {
      setEditingExperience(null);
    } else {
      notifyOnClose({ name: CloseEventName.DISMISS });
    }
  };

  const handleEditExperience = (experience: Experience) => {
    setEditingExperience(experience);
  };

  const handleExperienceSaved = async () => {
    await onExperiencesUpdated();
    setEditingExperience(null);
  };

  const handleDeleteExperience = async (experience: Experience) => {
    setExperienceToDelete(experience);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDeleteExperience = async () => {
    if (!experienceToDelete) return;

    // Close the confirmation dialog immediately when confirming deletion
    setShowDeleteConfirmDialog(false);
    setIsDeletingExperience(true);

    try {
      // Get services instances.
      const userPreferencesStateService = UserPreferencesStateService.getInstance();
      const experienceService = ExperienceService.getInstance();

      const sessionId = userPreferencesStateService.getActiveSessionId();
      if (!sessionId) {
        throw new Error("No active session found");
      }

      // Delete the experience
      await experienceService.deleteExperience(sessionId, experienceToDelete.UUID);
      console.info("Experience deleted successfully", { experienceId: experienceToDelete.UUID });

      // Refresh the experiences
      await onExperiencesUpdated();

      enqueueSnackbar(t("experiences_delete_success"), { variant: "success" });
    } catch (error) {
      let errorMessage = t("experiences_delete_failed");

      if (error instanceof RestAPIError) {
        errorMessage = getUserFriendlyErrorMessage(error);
      }

      console.error(errorMessage, error);
      enqueueSnackbar(errorMessage, { variant: "error" });
    } finally {
      setIsDeletingExperience(false);
      setExperienceToDelete(null);
    }
  };

  const handleRequestRestoreToOriginalExperience = (experience: Experience) => {
    setExperienceToRestoreToOriginal(experience);
    setShowRestoreToOriginalConfirmDialog(true);
  };

  const confirmRestoreToOriginalExperience = async () => {
    if (!experienceToRestoreToOriginal) return;
    setShowRestoreToOriginalConfirmDialog(false);

    setIsRestoringExperience(true);
    const userPreferencesStateService = UserPreferencesStateService.getInstance();
    const experienceService = ExperienceService.getInstance();
    const sessionId = userPreferencesStateService.getActiveSessionId();

    if (!sessionId) {
      enqueueSnackbar(t("experiences_user_has_no_sessions"), { variant: "error" });
      setIsRestoringExperience(false);
      return;
    }

    try {
      // Get the original experience
      const uneditedExperience = await experienceService.getUneditedExperience(
        sessionId,
        experienceToRestoreToOriginal.UUID
      );

      // Update the current experience with all original fields
      await experienceService.updateExperience(sessionId, experienceToRestoreToOriginal.UUID, {
        experience_title: uneditedExperience.experience_title,
        timeline: uneditedExperience.timeline,
        company: uneditedExperience.company,
        location: uneditedExperience.location,
        work_type: uneditedExperience.work_type,
        summary: uneditedExperience.summary,
        top_skills: uneditedExperience.top_skills.map((skill) => ({
          UUID: skill.UUID,
          preferredLabel: skill.preferredLabel,
        })),
      });

      enqueueSnackbar(t("experiences_restore_success"), { variant: "success" });
      await onExperiencesUpdated();
    } catch (error) {
      console.error(new ExperienceError("Failed to restore experience:", error));
      enqueueSnackbar(t("experiences_restore_failed"), { variant: "error" });
    } finally {
      setIsRestoringExperience(false);
      setExperienceToRestoreToOriginal(null);
    }
  };

  const cancelRestoreToOriginalExperience = () => {
    setShowRestoreToOriginalConfirmDialog(false);
    setExperienceToRestoreToOriginal(null);
  };

  const handleRestoreExperience = async (experience: Experience) => {
    setIsRestoringExperience(true);
    const userPreferencesStateService = UserPreferencesStateService.getInstance();
    const experienceService = ExperienceService.getInstance();
    const userPreferences = userPreferencesStateService.getUserPreferences();
    if (!userPreferences?.sessions.length) {
      enqueueSnackbar(t("experiences_user_has_no_sessions"), { variant: "error" });
      setIsRestoringExperience(false);
      return;
    }
    const sessionId = userPreferencesStateService.getActiveSessionId();
    if (!sessionId) {
      enqueueSnackbar(t("experiences_no_active_session"), { variant: "error" });
      setIsRestoringExperience(false);
      return;
    }
    try {
      await experienceService.restoreDeletedExperience(sessionId, experience.UUID);
      console.info("Deleted experience restored successfully", { experienceId: experience.UUID });
      enqueueSnackbar(t("experiences_restore_success"), { variant: "success" });
      await onExperiencesUpdated();
    } catch (error) {
      console.error(new ExperienceError("Failed to restore experience:", error));
      enqueueSnackbar(t("experiences_restore_failed"), { variant: "error" });
    } finally {
      setIsRestoringExperience(false);
    }
  };

  // Group experiences by work type using experiences with filtered skills
  const groupedExperiences = useMemo(() => groupExperiencesByWorkType(sortedExperiences), [sortedExperiences]);

  // Filter out deleted skills from explored experiences for download
  const exploredExperiences = useMemo(() => {
    return sortedExperiences.filter((experience) => experience.exploration_phase === DiveInPhase.PROCESSED);
  }, [sortedExperiences]);

  const tooltipText = t("experiences_personal_info_tooltip");

  // Disable download button if no explored experiences are available
  const disableDownloadButton = useMemo(() => exploredExperiences.length < 1, [exploredExperiences.length]);
  const renderDrawerContent = () => {
    if (showRestoreDrawer) {
      return (
        <RestoreExperiencesDrawer
          isOpen={showRestoreDrawer}
          onClose={() => setShowRestoreDrawer(false)}
          onRestore={handleRestoreExperience}
          sessionId={UserPreferencesStateService.getInstance().getActiveSessionId() || 0}
          onExperiencesRestored={onExperiencesUpdated}
          currentExperiences={experiences}
        />
      );
    } else if (editingExperience) {
      return (
        <Slide direction="left" in={true} appear={true}>
          <Box>
            <ExperienceEditForm
              experience={editingExperience}
              notifyOnSave={handleExperienceSaved}
              notifyOnCancel={handleClose}
              notifyOnUnsavedChange={setHasUnsavedChanges}
            />
          </Box>
        </Slide>
      );
    } else {
      // Main drawer content
      return (
        <Box
          display="flex"
          flexDirection="column"
          padding={isSmallMobile ? theme.fixedSpacing(theme.tabiyaSpacing.md) : theme.tabiyaSpacing.xl}
          gap={theme.fixedSpacing(isSmallMobile ? theme.tabiyaSpacing.lg : theme.tabiyaSpacing.xl)}
          sx={{ minHeight: "100%" }}
        >
          <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <ExperiencesDrawerHeader notifyOnClose={handleClose} title={t("experiences_and_skills_title")} />
            <Box display="flex" flexDirection="column" alignItems="end" justifyContent="flex-end">
              <Suspense
                fallback={
                  <Skeleton variant="rectangular" height={40} width={theme.spacing(20)} sx={{ borderRadius: 1 }} />
                }
              >
                <LazyLoadedDownloadDropdown
                  name={personalInfo.fullName}
                  email={personalInfo.contactEmail}
                  phone={personalInfo.phoneNumber}
                  address={personalInfo.address}
                  experiences={exploredExperiences}
                  conversationConductedAt={conversationConductedAt}
                  disabled={disableDownloadButton}
                />
              </Suspense>
            </Box>
          </Box>
          <Box display="flex" flexDirection="column" gap={2}>
            <CustomAccordion title={t("experiences_personal_information_title")} tooltipText={tooltipText}>
              <Typography variant="h6" data-testid={DATA_TEST_ID.PERSONAL_INFORMATION_TITLE} sx={{ display: "none" }}>
                {t("experiences_personal_information_title")}
              </Typography>
              <CustomTextField
                label={`${t("experiences_personal_info_name_label")}`}
                placeholder={t("experiences_personal_info_name_placeholder")}
                value={personalInfo.fullName}
                onChange={handleInputChange("fullName")}
              />
              <CustomTextField
                label={`${t("experiences_personal_info_email_label")}`}
                placeholder={t("experiences_personal_info_email_placeholder")}
                value={personalInfo.contactEmail}
                onChange={handleInputChange("contactEmail")}
              />
              <CustomTextField
                label={`${t("experiences_personal_info_phone_label")}`}
                placeholder={t("experiences_personal_info_phone_placeholder")}
                value={personalInfo.phoneNumber}
                onChange={handleInputChange("phoneNumber")}
              />
              <CustomTextField
                label={`${t("experiences_personal_info_address_label")}`}
                placeholder={t("experiences_personal_info_address_placeholder")}
                value={personalInfo.address}
                onChange={handleInputChange("address")}
              />
            </CustomAccordion>
            <Divider
              color="primary"
              sx={{ height: "0.2rem", marginY: isSmallMobile ? 8 : 2, marginRight: 1 }}
              data-testid={DATA_TEST_ID.EXPERIENCES_DIVIDER}
            />
            <Box display="flex" flexDirection="column" gap={isSmallMobile ? 10 : 6}>
              {/* LOADING STATE */}
              {isLoading && (
                <Box data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_LOADER}>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <LoadingExperienceDrawerContent key={index} />
                  ))}
                </Box>
              )}

              {/* EMPTY STATE */}
              {experiences.length === 0 && !isLoading && (
                <Box sx={{ fontSize: theme.typography.body1.fontSize, fontWeight: "bold" }}>
                  <Typography variant="h1" textAlign={"center"}>
                    🤷‍♀️
                  </Typography>
                  <Typography>{t("experiences_empty_state_message")}</Typography>
                </Box>
              )}

              {/* EXPERIENCES */}
              {!isLoading && (
                <Box display="flex" flexDirection="column" gap={isSmallMobile ? 10 : 6}>
                  <ExperienceCategory
                    icon={<StoreIcon />}
                    title={ReportContent.SELF_EMPLOYMENT_TITLE}
                    experiences={groupedExperiences.selfEmploymentExperiences}
                    onEditExperience={handleEditExperience}
                    onDeleteExperience={handleDeleteExperience}
                    onRestoreToOriginalExperience={handleRequestRestoreToOriginalExperience}
                  />
                  <ExperienceCategory
                    icon={<WorkIcon />}
                    title={ReportContent.SALARY_WORK_TITLE}
                    experiences={groupedExperiences.salaryWorkExperiences}
                    onEditExperience={handleEditExperience}
                    onDeleteExperience={handleDeleteExperience}
                    onRestoreToOriginalExperience={handleRequestRestoreToOriginalExperience}
                  />
                  <ExperienceCategory
                    icon={<VolunteerActivismIcon />}
                    title={ReportContent.UNPAID_WORK_TITLE}
                    experiences={groupedExperiences.unpaidWorkExperiences}
                    onEditExperience={handleEditExperience}
                    onDeleteExperience={handleDeleteExperience}
                    onRestoreToOriginalExperience={handleRequestRestoreToOriginalExperience}
                  />
                  <ExperienceCategory
                    icon={<SchoolIcon />}
                    title={ReportContent.TRAINEE_WORK_TITLE}
                    experiences={groupedExperiences.traineeWorkExperiences}
                    onEditExperience={handleEditExperience}
                    onDeleteExperience={handleDeleteExperience}
                    onRestoreToOriginalExperience={handleRequestRestoreToOriginalExperience}
                  />
                  <ExperienceCategory
                    icon={<QuizIcon />}
                    title={ReportContent.UNCATEGORIZED_TITLE}
                    experiences={groupedExperiences.uncategorizedExperiences}
                    tooltipText={t("experiences_uncategorized_tooltip")}
                    onEditExperience={handleEditExperience}
                    onDeleteExperience={handleDeleteExperience}
                    onRestoreToOriginalExperience={handleRequestRestoreToOriginalExperience}
                  />
                </Box>
              )}
            </Box>
          </Box>
          <Box
            sx={{
              marginTop: "auto",
              padding: theme.fixedSpacing(theme.tabiyaSpacing.md),
              alignSelf: "center",
            }}
          >
            <CustomLink
              onClick={() => setShowRestoreDrawer(true)}
              disableWhenOffline={true}
              data-testid={DATA_TEST_ID.RESTORE_DELETED_EXPERIENCES_LINK}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: theme.fixedSpacing(theme.tabiyaSpacing.xs),
              }}
            >
              <RestoreIcon color={theme.palette.text.primary} />
              {t("experiences_restore_deleted_link")}
            </CustomLink>
          </Box>
        </Box>
      );
    }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={isOpen}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: isMobile ? "100%" : "40%",
          },
        }}
        data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTAINER}
      >
        {renderDrawerContent()}
      </Drawer>
      <ConfirmModalDialog
        title={t("experiences_unsaved_changes_title")}
        content={<>{t("experiences_unsaved_changes_content")}</>}
        isOpen={showConfirmDialog}
        onCancel={handleConfirmClose}
        onConfirm={() => setShowConfirmDialog(false)}
        onDismiss={() => setShowConfirmDialog(false)}
        cancelButtonText={t("experiences_unsaved_changes_close_button")}
        confirmButtonText={t("experiences_unsaved_changes_keep_editing_button")}
        showCloseIcon={true}
        data-testid={DATA_TEST_ID.UNSAVED_CHANGES_DIALOG}
      />
      <ConfirmModalDialog
        isOpen={showDeleteConfirmDialog}
        title={t("experiences_delete_title")}
        content={<>{t("experiences_delete_content")}</>}
        onConfirm={confirmDeleteExperience}
        onDismiss={() => setShowDeleteConfirmDialog(false)}
        onCancel={() => setShowDeleteConfirmDialog(false)}
        confirmButtonText={t("experiences_delete_confirm_button")}
  cancelButtonText={t("common.buttons.cancel")}
        showCloseIcon
        data-testid={DATA_TEST_ID.DELETE_EXPERIENCE_DIALOG}
      />
      <ConfirmModalDialog
        isOpen={showRestoreToOriginalConfirmDialog}
        title={t("experiences_revert_title")}
        content={<>{t("experiences_revert_content")}</>}
        onConfirm={confirmRestoreToOriginalExperience}
        onDismiss={cancelRestoreToOriginalExperience}
        onCancel={cancelRestoreToOriginalExperience}
        confirmButtonText={t("experiences_revert_confirm_button")}
  cancelButtonText={t("common.buttons.cancel")}
        showCloseIcon
        data-testid={DATA_TEST_ID.RESTORE_TO_ORIGINAL_CONFIRM_DIALOG}
      />
      <Backdrop isShown={isDeletingExperience} message={t("experiences_deleting_backdrop")} />
      <Backdrop isShown={isRestoringExperience} message={t("experiences_restoring_backdrop")} />
    </>
  );
};

export default ExperiencesDrawer;
