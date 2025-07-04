import React, { useEffect, useState, useMemo } from "react";
import { Box, Slide, Typography, Divider } from "@mui/material";
import { Experience } from "src/experiences/experienceService/experiences.types";
import ExperienceCategory, { ExperienceCategoryVariant } from "src/experiences/experiencesDrawer/components/experienceCategory/ExperienceCategory";
import ExperienceService from "src/experiences/experienceService/experienceService";
import { groupExperiencesByWorkType } from "src/experiences/report/util";
import { ReportContent } from "src/experiences/report/reportContent";
import ExperiencesDrawerHeader from "src/experiences/experiencesDrawer/components/experiencesDrawerHeader/ExperiencesDrawerHeader";
import { LoadingExperienceDrawerContent } from "../experiencesDrawerContent/ExperiencesDrawerContent";
import { DATA_TEST_ID } from "src/experiences/experiencesDrawer/ExperiencesDrawer";
import StoreIcon from "@mui/icons-material/Store";
import WorkIcon from "@mui/icons-material/Work";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import SchoolIcon from "@mui/icons-material/School";
import QuizIcon from "@mui/icons-material/Quiz";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { ExperienceError } from "src/error/commonErrors";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";

interface RestoreExperiencesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (experience: Experience) => Promise<void>;
  sessionId: number;
  onExperiencesRestored: () => Promise<void>;
  currentExperiences: Experience[];
}

const RestoreExperiencesDrawer: React.FC<RestoreExperiencesDrawerProps> = ({
  isOpen,
  onClose,
  onRestore,
  sessionId,
  onExperiencesRestored,
  currentExperiences,
}) => {
  const [deletedExperiences, setDeletedExperiences] = useState<Experience[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (!isOpen) return;
    const fetchDeletedExperiences = async () => {
      setIsLoading(true);
      try {
        const originalExperiences = await ExperienceService.getInstance().getExperiences(sessionId, true);
        const currentIds = new Set(currentExperiences.map(e => e.UUID));
        const deleted = originalExperiences.filter(e => !currentIds.has(e.UUID));
        setDeletedExperiences(deleted);
      } catch (error) {
        console.error(new ExperienceError("Failed to fetch deleted experiences", error));
        enqueueSnackbar("Failed to fetch deleted experiences. Please try again later.", {
          variant: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchDeletedExperiences().then();
  }, [isOpen, sessionId, currentExperiences, enqueueSnackbar]);

  const handleRestore = async (experience: Experience) => {
    await onRestore(experience);
    await onExperiencesRestored();
    onClose();
  };

  const groupedExperiences = useMemo(() => groupExperiencesByWorkType(deletedExperiences), [deletedExperiences]);

  const renderContent = () => {
    if (isLoading) {
      return (<Box data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTENT_LOADER}>
        {Array.from({ length: 5 }).map((_, index) => (
          <LoadingExperienceDrawerContent key={index} />
        ))}
      </Box>);
    } else if (deletedExperiences.length === 0) {
      return <Box sx={{ fontSize: (theme) => theme.typography.body1.fontSize, fontWeight: "bold", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: (theme) => theme.fixedSpacing(theme.tabiyaSpacing.lg) }}>
        <Typography variant="h1" textAlign={"center"}>
          🤷‍♀️
        </Typography>
        <Typography data-testid={DATA_TEST_ID.RESTORE_EXPERIENCES_EMPTY_MESSAGE}>No deleted experiences found.</Typography>
        <PrimaryButton onClick={onClose} data-testid={DATA_TEST_ID.RESTORE_EXPERIENCES_GO_BACK_BUTTON}>Go Back</PrimaryButton>
      </Box>
    } else {
      return (
        <Box display="flex" flexDirection="column" gap={4}>
          <ExperienceCategory
            icon={<StoreIcon />}
            title={ReportContent.SELF_EMPLOYMENT_TITLE}
            experiences={groupedExperiences.selfEmploymentExperiences}
            onRestoreExperience={handleRestore}
            variant={ExperienceCategoryVariant.RESTORE}
          />
          <ExperienceCategory
            icon={<WorkIcon />}
            title={ReportContent.SALARY_WORK_TITLE}
            experiences={groupedExperiences.salaryWorkExperiences}
            onRestoreExperience={handleRestore}
            variant={ExperienceCategoryVariant.RESTORE}
          />
          <ExperienceCategory
            icon={<VolunteerActivismIcon />}
            title={ReportContent.UNPAID_WORK_TITLE}
            experiences={groupedExperiences.unpaidWorkExperiences}
            onRestoreExperience={handleRestore}
            variant={ExperienceCategoryVariant.RESTORE}
          />
          <ExperienceCategory
            icon={<SchoolIcon />}
            title={ReportContent.TRAINEE_WORK_TITLE}
            experiences={groupedExperiences.traineeWorkExperiences}
            onRestoreExperience={handleRestore}
            variant={ExperienceCategoryVariant.RESTORE}
          />
          <ExperienceCategory
            icon={<QuizIcon />}
            title={ReportContent.UNCATEGORIZED_TITLE}
            experiences={groupedExperiences.uncategorizedExperiences}
            onRestoreExperience={handleRestore}
            variant={ExperienceCategoryVariant.RESTORE}
          />
        </Box>
      );
    }
  };

  return (
    <Slide direction="left" in={true} appear={true}>
      <Box p={4} display="flex" flexDirection="column" gap={4} height={"100%"}>
        <ExperiencesDrawerHeader notifyOnClose={onClose} title={"Restore Experiences"} />
        <Typography variant="h5" data-testid={DATA_TEST_ID.RESTORE_EXPERIENCES_TITLE} sx={{ display: 'none' }}>Restore Experiences</Typography>
        <Divider />
        {renderContent()}
      </Box>
    </Slide>
  );
};

export default RestoreExperiencesDrawer;