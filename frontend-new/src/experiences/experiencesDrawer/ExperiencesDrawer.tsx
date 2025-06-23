import React, { useEffect, useMemo, useState, Suspense } from "react";
import { Box, Divider, Drawer, Skeleton, Typography, useMediaQuery, useTheme, Slide } from "@mui/material";
import { Theme } from "@mui/material/styles";
import ExperiencesDrawerHeader from "src/experiences/experiencesDrawer/components/experiencesDrawerHeader/ExperiencesDrawerHeader";
import { LoadingExperienceDrawerContent } from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import { Experience } from "src/experiences/experienceService/experiences.types";
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

  // Experiences with top skills
  const experiencesWithTopSkills = useMemo(
    () => experiences.filter((experience) => experience.top_skills && experience.top_skills.length > 0),
    [experiences]
  );

  // Group experiences by work type
  const groupedExperiences = useMemo(() => groupExperiencesByWorkType(experiences), [experiences]);

  const tooltipText =
    "The fields are prefilled with information you may have provided earlier and are stored securely on your device. Fill in missing details to personalize your CV.";
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
        {editingExperience ? (
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
        ) : (
          <Box
            display="flex"
            flexDirection="column"
            padding={isSmallMobile ? theme.fixedSpacing(theme.tabiyaSpacing.md) : theme.tabiyaSpacing.xl}
            gap={theme.fixedSpacing(isSmallMobile ? theme.tabiyaSpacing.lg : theme.tabiyaSpacing.xl)}
          >
            <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
              <ExperiencesDrawerHeader notifyOnClose={handleClose} />
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
                    experiences={experiencesWithTopSkills}
                    conversationConductedAt={conversationConductedAt}
                    disabled={!hasTopSkills}
                  />
                </Suspense>
              </Box>
            </Box>
            <Box display="flex" flexDirection="column" gap={2}>
              <CustomAccordion title="Personal Information" tooltipText={tooltipText}>
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
                    />
                    <ExperienceCategory
                      icon={<WorkIcon />}
                      title={ReportContent.SALARY_WORK_TITLE}
                      experiences={groupedExperiences.salaryWorkExperiences}
                      onEditExperience={handleEditExperience}
                    />
                    <ExperienceCategory
                      icon={<VolunteerActivismIcon />}
                      title={ReportContent.UNPAID_WORK_TITLE}
                      experiences={groupedExperiences.unpaidWorkExperiences}
                      onEditExperience={handleEditExperience}
                    />
                    <ExperienceCategory
                      icon={<SchoolIcon />}
                      title={ReportContent.TRAINEE_WORK_TITLE}
                      experiences={groupedExperiences.traineeWorkExperiences}
                      onEditExperience={handleEditExperience}
                    />
                    <ExperienceCategory
                      icon={<QuizIcon />}
                      title={ReportContent.UNCATEGORIZED_TITLE}
                      experiences={groupedExperiences.uncategorizedExperiences}
                      tooltipText="Based on the conversation, these experiences couldn't be automatically categorized."
                      onEditExperience={handleEditExperience}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}
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
      />
    </>
  );
};

export default ExperiencesDrawer;
