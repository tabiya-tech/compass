import React, { useEffect, useMemo, useState, Suspense } from "react";
import { Box, Divider, Drawer, Skeleton, Typography, useMediaQuery, useTheme, Slide } from "@mui/material";
import { Theme } from "@mui/material/styles";
import ExperiencesDrawerHeader from "src/experiences/experiencesDrawer/components/experiencesDrawerHeader/ExperiencesDrawerHeader";
import { LoadingExperienceDrawerContent } from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import { Experience, DiveInPhase } from "src/experiences/experienceService/experiences.types";
import { StoredPersonalInfo } from "src/sensitiveData/types";
import CustomTextField from "src/theme/CustomTextField/CustomTextField";
import CustomAccordion from "src/theme/CustomAccordion/CustomAccordion";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { groupExperiencesByWorkType } from "src/experiences/report/util";
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
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const [personalInfo, setPersonalInfo] = useLocalStorage("personalInfo", {
    fullName: "",
    phoneNumber: "",
    contactEmail: "",
    address: "",
  });
  const [hasTopSkills, setHasTopSkills] = useState(false);
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

  useEffect(() => {
    setHasTopSkills(experiences.some((experience) => experience.top_skills && experience.top_skills.length > 0));
  }, [experiences]);

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
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

      // Refresh the experiences
      await onExperiencesUpdated();

      enqueueSnackbar("Experience deleted successfully!", { variant: "success" });
    } catch (error) {
      let errorMessage = "Failed to delete experience.";

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
      enqueueSnackbar("User has no sessions", { variant: "error" });
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
          deleted: skill.deleted,
        })),
      });

      enqueueSnackbar("Experience restored successfully!", { variant: "success" });
      await onExperiencesUpdated();
    } catch (error) {
      console.error(new ExperienceError("Failed to restore experience:", error));
      enqueueSnackbar("Failed to restore experience.", { variant: "error" });
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
      enqueueSnackbar("User has no sessions", { variant: "error" });
      setIsRestoringExperience(false);
      return;
    }
    const sessionId = userPreferencesStateService.getActiveSessionId();
    if (!sessionId) {
      enqueueSnackbar("No active session found", { variant: "error" });
      setIsRestoringExperience(false);
      return;
    }
    try {
      await experienceService.restoreDeletedExperience(sessionId, experience.UUID);
      enqueueSnackbar("Experience restored successfully!", { variant: "success" });
      await onExperiencesUpdated();
    } catch (error) {
      console.error(new ExperienceError("Failed to restore experience:", error));
      enqueueSnackbar("Failed to restore experience.", { variant: "error" });
    } finally {
      setIsRestoringExperience(false);
    }
  };

  // Experiences that have been processed
  const exploredExperiences = useMemo(
    () => experiences.filter((experience) => experience.exploration_phase === DiveInPhase.PROCESSED),
    [experiences]
  );

  // Group experiences by work type using experiences with filtered skills
  const groupedExperiences = useMemo(
    () => groupExperiencesByWorkType(experiences),
    [experiences]
  );

  // Filter out deleted skills from explored experiences for download
  const exploredExperiencesWithoutDeletedSkills = useMemo(() => {
    return exploredExperiences.map((experience) => ({
      ...experience,
      top_skills: experience.top_skills.filter((skill) => !skill.deleted),
    }));
  }, [exploredExperiences]);

  const tooltipText =
    "The fields are prefilled with information you may have provided earlier and are stored securely on your device. Fill in missing details to personalize your CV.";

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
            <ExperiencesDrawerHeader notifyOnClose={handleClose} title={"Experiences and Skills"} />
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
                  experiences={exploredExperiencesWithoutDeletedSkills}
                  conversationConductedAt={conversationConductedAt}
                  disabled={!hasTopSkills}
                />
              </Suspense>
            </Box>
          </Box>
          <Box display="flex" flexDirection="column" gap={2}>
            <CustomAccordion title="Personal Information" tooltipText={tooltipText}>
              <Typography variant="h6" data-testid={DATA_TEST_ID.PERSONAL_INFORMATION_TITLE} sx={{ display: "none" }}>
                Personal Information
              </Typography>
              <CustomTextField
                label="Name:"
                placeholder="Enter your name here"
                value={personalInfo.fullName}
                onChange={handleInputChange("fullName")}
              />
              <CustomTextField
                label="Email:"
                placeholder="Enter your email here"
                value={personalInfo.contactEmail}
                onChange={handleInputChange("contactEmail")}
              />
              <CustomTextField
                label="Phone:"
                placeholder="Enter your phone number here"
                value={personalInfo.phoneNumber}
                onChange={handleInputChange("phoneNumber")}
              />
              <CustomTextField
                label="Address:"
                placeholder="Enter your address here"
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
                  <Typography>We haven't yet discovered any experiences so far, Let's continue chatting.</Typography>
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
                    tooltipText="Based on the conversation, these experiences couldn't be automatically categorized."
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
              padding: isSmallMobile ? theme.fixedSpacing(theme.tabiyaSpacing.md) : 0,
              alignSelf: "center",
            }}
          >
            <CustomLink
              onClick={() => setShowRestoreDrawer(true)}
              disableWhenOffline={true}
              data-testid={DATA_TEST_ID.RESTORE_DELETED_EXPERIENCES_LINK}
            >
              Restore deleted experiences
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
        title="Unsaved Changes"
        content={<>You have unsaved changes. Are you sure you want to close without saving?</>}
        isOpen={showConfirmDialog}
        onCancel={handleConfirmClose}
        onConfirm={() => setShowConfirmDialog(false)}
        onDismiss={() => setShowConfirmDialog(false)}
        cancelButtonText="Close"
        confirmButtonText="Keep Editing"
        showCloseIcon={true}
        data-testid={DATA_TEST_ID.UNSAVED_CHANGES_DIALOG}
      />
      <ConfirmModalDialog
        isOpen={showDeleteConfirmDialog}
        title="Delete Experience"
        content={<>Are you sure you want to delete this experience? This action cannot be undone.</>}
        onConfirm={confirmDeleteExperience}
        onDismiss={() => setShowDeleteConfirmDialog(false)}
        onCancel={() => setShowDeleteConfirmDialog(false)}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
        showCloseIcon
        data-testid={DATA_TEST_ID.DELETE_EXPERIENCE_DIALOG}
      />
      <ConfirmModalDialog
        isOpen={showRestoreToOriginalConfirmDialog}
        title="Revert Experience"
        content={
          <>
            Are you sure you want to revert this experience to its unedited version? This will overwrite any changes
            you've made.
          </>
        }
        onConfirm={confirmRestoreToOriginalExperience}
        onDismiss={cancelRestoreToOriginalExperience}
        onCancel={cancelRestoreToOriginalExperience}
        confirmButtonText="Revert"
        cancelButtonText="Cancel"
        showCloseIcon
        data-testid={DATA_TEST_ID.RESTORE_TO_ORIGINAL_CONFIRM_DIALOG}
      />
      <Backdrop isShown={isDeletingExperience} message="Deleting experience..." />
      <Backdrop isShown={isRestoringExperience} message="Restoring experience..." />
    </>
  );
};

export default ExperiencesDrawer;
