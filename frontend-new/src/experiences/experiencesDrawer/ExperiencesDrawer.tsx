import React, { Suspense, useMemo, useState } from "react";
import { Box, Drawer, Skeleton, Slide, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Theme } from "@mui/material/styles";
import ExperiencesDrawerHeader from "src/experiences/experiencesDrawer/components/experiencesDrawerHeader/ExperiencesDrawerHeader";
import { LoadingExperienceDrawerContent } from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import { DiveInPhase, Experience } from "src/experiences/experienceService/experiences.types";
import { groupExperiencesByWorkType } from "src/experiences/report/util";
import { sortSkillsByOrderIndex } from "src/experiences/experiencesDrawer/util";
import { ReportContent } from "src/experiences/report/reportContent";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import SchoolIcon from "@mui/icons-material/School";
import QuizIcon from "@mui/icons-material/Quiz";
import WorkIcon from "@mui/icons-material/Work";
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
import { getSkillsReportOutputConfig } from "../report/config/getConfig";
import ShareReportButton from "src/experiences/experiencesDrawer/components/shareReportButton/ShareReportButton";
import { useUserProfileContext } from "src/profile/UserProfileContext";
import i18n from "src/i18n/i18n";

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
  UNSAVED_CHANGES_DIALOG: `unsaved-changes-dialog-${uniqueId}`,
  DELETE_EXPERIENCE_DIALOG: `delete-experience-dialog-${uniqueId}`,
  RESTORE_TO_ORIGINAL_CONFIRM_DIALOG: `restore-to-original-confirm-dialog-${uniqueId}`,
  RESTORE_DELETED_EXPERIENCES_LINK: `restore-deleted-experiences-link-${uniqueId}`,
  PERSONAL_INFORMATION_TITLE: `personal-information-title-${uniqueId}`,
};

const emptyIfNotAvailable = (value: string | null | undefined): string =>
  value && value !== i18n.t("home.profile.notAvailable") ? value : "";

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
  const { profileData, refreshProfileData } = useUserProfileContext();

  const profileDisplay = useMemo(
    () => ({
      name: emptyIfNotAvailable(profileData.name),
      email: profileData.email ?? "",
      location: emptyIfNotAvailable(profileData.location),
      school: emptyIfNotAvailable(profileData.school),
      program: emptyIfNotAvailable(profileData.program),
    }),
    [profileData.name, profileData.email, profileData.location, profileData.school, profileData.program]
  );

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
    refreshProfileData();
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
      refreshProfileData();

      enqueueSnackbar(t("experiences.experiencesDrawer.deleteSuccess"), { variant: "success" });
    } catch (error) {
      let errorMessage = t("experiences.experiencesDrawer.deleteFailed");

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
      enqueueSnackbar(t("experiences.experiencesDrawer.userHasNoSessions"), { variant: "error" });
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

      enqueueSnackbar(t("experiences.experiencesDrawer.restoreSuccess"), { variant: "success" });
      await onExperiencesUpdated();
      refreshProfileData();
    } catch (error) {
      console.error(new ExperienceError("Failed to restore experience:", error));
      enqueueSnackbar(t("experiences.experiencesDrawer.restoreFailed"), { variant: "error" });
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
      enqueueSnackbar(t("experiences.experiencesDrawer.userHasNoSessions"), { variant: "error" });
      setIsRestoringExperience(false);
      return;
    }
    const sessionId = userPreferencesStateService.getActiveSessionId();
    if (!sessionId) {
      enqueueSnackbar(t("experiences.experiencesDrawer.noActiveSession"), { variant: "error" });
      setIsRestoringExperience(false);
      return;
    }
    try {
      await experienceService.restoreDeletedExperience(sessionId, experience.UUID);
      console.info("Deleted experience restored successfully", { experienceId: experience.UUID });
      enqueueSnackbar(t("experiences.experiencesDrawer.restoreSuccess"), { variant: "success" });
      await onExperiencesUpdated();
      refreshProfileData();
    } catch (error) {
      console.error(new ExperienceError("Failed to restore experience:", error));
      enqueueSnackbar(t("experiences.experiencesDrawer.restoreFailed"), { variant: "error" });
    } finally {
      setIsRestoringExperience(false);
    }
  };

  const outputConfig = useMemo(() => {
    return getSkillsReportOutputConfig();
  }, []);

  // Group experiences by work type using experiences with filtered skills
  const groupedExperiences = useMemo(() => groupExperiencesByWorkType(sortedExperiences), [sortedExperiences]);

  // Filter out deleted skills from explored experiences for download
  const exploredExperiences = useMemo(() => {
    return sortedExperiences.filter((experience) => experience.exploration_phase === DiveInPhase.PROCESSED);
  }, [sortedExperiences]);

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
          onExperiencesRestored={async () => {
            await onExperiencesUpdated();
            refreshProfileData();
          }}
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
          gap={theme.fixedSpacing(theme.tabiyaSpacing.lg)}
          sx={{ minHeight: "100%" }}
        >
          <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.xl)}>
            <ExperiencesDrawerHeader
              notifyOnClose={handleClose}
              title={t("experiences.experiencesDrawer.reportTitle")}
              lastUpdated={conversationConductedAt}
            />
            <Box
              display="flex"
              flexDirection="row"
              flexWrap="wrap"
              whiteSpace="normal"
              gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}
              width="100%"
            >
              <Suspense fallback={<Skeleton variant="rectangular" height={40} width="100%" sx={{ borderRadius: 1 }} />}>
                <Box sx={{ flex: { xs: "1 1 100%", sm: 1 }, minWidth: 0 }}>
                  <LazyLoadedDownloadDropdown
                    name={profileDisplay.name}
                    email={profileDisplay.email}
                    location={profileDisplay.location}
                    school={profileDisplay.school}
                    program={profileDisplay.program}
                    experiences={exploredExperiences}
                    conversationConductedAt={conversationConductedAt}
                    disabled={disableDownloadButton}
                    outputConfig={outputConfig}
                  />
                </Box>
              </Suspense>
              <Box sx={{ flex: { xs: "1 1 100%", sm: "0 0 auto" }, minWidth: 0 }}>
                <ShareReportButton
                  name={profileDisplay.name}
                  email={profileDisplay.email}
                  location={profileDisplay.location}
                  school={profileDisplay.school}
                  program={profileDisplay.program}
                  experiences={exploredExperiences}
                  conversationConductedAt={conversationConductedAt}
                  disabled={disableDownloadButton}
                  outputConfig={outputConfig}
                />
              </Box>
            </Box>
          </Box>
          <Box display="flex" flexDirection="column" gap={0.5} data-testid={DATA_TEST_ID.PERSONAL_INFORMATION_TITLE}>
            <Typography variant="h4" fontWeight="bold">
              {profileDisplay.name}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {profileDisplay.email}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {profileDisplay.location}
            </Typography>
          </Box>
          {profileDisplay.school && (
            <Box display="flex" flexDirection="column" gap={theme.tabiyaSpacing.sm}>
              <Typography variant="overline" fontWeight="800" color={theme.palette.text.secondary}>
                {t("experiences.experiencesDrawer.educationLabel")}
              </Typography>
              <Box>
                <Typography variant="body2">
                  <b>
                    {profileDisplay.school}
                    {profileDisplay.program && ` — ${profileDisplay.program}`}
                  </b>
                </Typography>
              </Box>
            </Box>
          )}
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
              <Box sx={{ fontSize: theme.typography.body1.fontSize, fontWeight: "bold", paddingTop: theme.spacing(8) }}>
                <Typography variant="h1" textAlign={"center"}>
                  🤷‍♀️
                </Typography>
                <Typography textAlign="center">{t("experiences.experiencesDrawer.emptyStateMessage")}</Typography>
              </Box>
            )}

            {/* EXPERIENCES */}
            {!isLoading && (
              <Box>
                {experiences.length > 0 && (
                  <Typography variant="overline" fontWeight="800" color={theme.palette.text.secondary}>
                    {t("experiences.experiencesDrawer.experiencesAndSkillsLabel")}
                  </Typography>
                )}
                <Box display="flex" flexDirection="column" gap={isSmallMobile ? 8 : 4} paddingTop={2}>
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
                    tooltipText={t("experiences.experiencesDrawer.uncategorizedTooltip")}
                    onEditExperience={handleEditExperience}
                    onDeleteExperience={handleDeleteExperience}
                    onRestoreToOriginalExperience={handleRequestRestoreToOriginalExperience}
                  />
                </Box>
              </Box>
            )}
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
                whiteSpace: "normal",
                textAlign: "center",
              }}
            >
              <RestoreIcon color={theme.palette.text.primary} />
              {t("experiences.experiencesDrawer.restoreDeletedLink")}
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
        title={t("experiences.experiencesDrawer.unsavedChanges.title")}
        content={<>{t("experiences.experiencesDrawer.unsavedChanges.content")}</>}
        isOpen={showConfirmDialog}
        onCancel={handleConfirmClose}
        onConfirm={() => setShowConfirmDialog(false)}
        onDismiss={() => setShowConfirmDialog(false)}
        cancelButtonText={t("experiences.experiencesDrawer.unsavedChanges.closeButton")}
        confirmButtonText={t("experiences.experiencesDrawer.unsavedChanges.keepEditingButton")}
        showCloseIcon={true}
        data-testid={DATA_TEST_ID.UNSAVED_CHANGES_DIALOG}
      />
      <ConfirmModalDialog
        isOpen={showDeleteConfirmDialog}
        title={t("experiences.experiencesDrawer.delete.title")}
        content={<>{t("experiences.experiencesDrawer.delete.content")}</>}
        onConfirm={confirmDeleteExperience}
        onDismiss={() => setShowDeleteConfirmDialog(false)}
        onCancel={() => setShowDeleteConfirmDialog(false)}
        confirmButtonText={t("experiences.experiencesDrawer.delete.confirmButton")}
        cancelButtonText={t("common.buttons.cancel")}
        showCloseIcon
        data-testid={DATA_TEST_ID.DELETE_EXPERIENCE_DIALOG}
      />
      <ConfirmModalDialog
        isOpen={showRestoreToOriginalConfirmDialog}
        title={t("experiences.experiencesDrawer.revert.title")}
        content={<>{t("experiences.experiencesDrawer.revert.content")}</>}
        onConfirm={confirmRestoreToOriginalExperience}
        onDismiss={cancelRestoreToOriginalExperience}
        onCancel={cancelRestoreToOriginalExperience}
        confirmButtonText={t("experiences.experiencesDrawer.revert.confirmButton")}
        cancelButtonText={t("common.buttons.cancel")}
        showCloseIcon
        data-testid={DATA_TEST_ID.RESTORE_TO_ORIGINAL_CONFIRM_DIALOG}
      />
      <Backdrop isShown={isDeletingExperience} message={t("experiences.experiencesDrawer.deletingBackdrop")} />
      <Backdrop isShown={isRestoringExperience} message={t("experiences.experiencesDrawer.restoringBackdrop")} />
    </>
  );
};

export default ExperiencesDrawer;
