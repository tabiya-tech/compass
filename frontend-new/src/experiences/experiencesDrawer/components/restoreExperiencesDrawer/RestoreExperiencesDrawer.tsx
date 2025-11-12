import React, { useEffect, useMemo, useState } from "react";
import { Box, Divider, Slide, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Experience } from "src/experiences/experienceService/experiences.types";
import ExperienceService from "src/experiences/experienceService/experienceService";
import ExperiencesDrawerHeader
  from "src/experiences/experiencesDrawer/components/experiencesDrawerHeader/ExperiencesDrawerHeader";
import { LoadingExperienceDrawerContent } from "../experiencesDrawerContent/ExperiencesDrawerContent";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { ExperienceError } from "src/error/commonErrors";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { Theme } from "@mui/material/styles";
import { TabiyaIconStyles } from "src/theme/applicationTheme/applicationTheme";
import { getWorkTypeIcon, getWorkTypeTitle } from "src/experiences/experiencesDrawer/util";
import { useTranslation } from "react-i18next";

const uniqueId = "086216b2-a180-4a13-ac3c-cfd23f46153f";

export const DATA_TEST_ID = {
  RESTORE_EXPERIENCES: `restore-experiences-drawer-${uniqueId}`,
  RESTORE_EXPERIENCES_EMPTY_MESSAGE: `restore-experiences-empty-message-${uniqueId}`,
  RESTORE_EXPERIENCES_GO_BACK_BUTTON: `restore-experiences-go-back-button-${uniqueId}`,
  RESTORE_EXPERIENCE_LOADER: `restore-experiences-loader-${uniqueId}`,
  RESTORE_EXPERIENCE_CONTAINER: `restore-experiences-container-${uniqueId}`,
  RESTORE_EXPERIENCE_TITLE: `restore-experience-title-${uniqueId}`,
  RESTORE_EXPERIENCE_WORK_TYPE: `restore-experience-work-type-${uniqueId}`,
  RESTORE_EXPERIENCE_BUTTON: `restore-experience-button-${uniqueId}`,
  RESTORE_EXPERIENCE_DATE: `restore-experience-date-${uniqueId}`,
};

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
  const theme = useTheme();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const [deletedExperiences, setDeletedExperiences] = useState<Experience[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const fetchDeletedExperiences = async () => {
      setIsLoading(true);
      try {
        const deletedExperiences = await ExperienceService.getInstance().getExperiences(sessionId,  true);
        setDeletedExperiences(deletedExperiences);
      } catch (error) {
        console.error(new ExperienceError("Failed to fetch deleted experiences", error));
        enqueueSnackbar(t("experiences.experiencesDrawer.components.restoreExperiencesDrawer.fetchFailed"), {
          variant: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchDeletedExperiences().then();
  }, [isOpen, sessionId, currentExperiences, enqueueSnackbar, t]);

  const handleRestore = async (experience: Experience) => {
    await onRestore(experience);
    await onExperiencesRestored();
    onClose();
  };

  // Sort all experiences by title
  const sortedExperiences = useMemo(
    () =>
      deletedExperiences.toSorted?.(
        (a, b) => (a.experience_title || "").localeCompare(b.experience_title || "")
      ) ?? [...deletedExperiences].sort((a, b) => (a.experience_title || "").localeCompare(b.experience_title || "")),
    [deletedExperiences]
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <Box data-testid={DATA_TEST_ID.RESTORE_EXPERIENCE_LOADER}>
          {Array.from({ length: 5 }).map((_, index) => (
            <LoadingExperienceDrawerContent key={index} />
          ))}
        </Box>
      );
    } else if (deletedExperiences.length === 0) {
      return (
        <Box
          sx={{
            fontSize: (theme) => theme.typography.body1.fontSize,
            fontWeight: "bold",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: (theme) => theme.fixedSpacing(theme.tabiyaSpacing.lg),
          }}
        >
          <Typography variant="h1" textAlign={"center"}>
            🤷‍♀️
          </Typography>
          <Typography data-testid={DATA_TEST_ID.RESTORE_EXPERIENCES_EMPTY_MESSAGE}>
            {t("experiences.experiencesDrawer.components.restoreExperiencesDrawer.empty")}
          </Typography>
          <PrimaryButton onClick={onClose} data-testid={DATA_TEST_ID.RESTORE_EXPERIENCES_GO_BACK_BUTTON}>
            {t("common.buttons.goBack")}
          </PrimaryButton>
        </Box>
      );
    } else {
      return (
        <>
          {sortedExperiences.map((experience) => (
            <Box
              key={experience.UUID}
              display="flex"
              flexDirection="column"
              gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}
              data-testid={DATA_TEST_ID.RESTORE_EXPERIENCE_CONTAINER}
            >
              <Box display="flex" alignItems="start" justifyContent="space-between">
                <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}>
                  <Typography
                    variant="subtitle1"
                    fontWeight="bold"
                    color={theme.palette.text.secondary}
                    data-testid={DATA_TEST_ID.RESTORE_EXPERIENCE_TITLE}
                  >
                    {experience.experience_title ?? <i>{t("experiences.experiencesDrawer.components.experiencesDrawerContent.untitled")}</i>}
                  </Typography>
                  <Box
                    display="flex"
                    alignItems="center"
                    gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}
                    data-testid={DATA_TEST_ID.RESTORE_EXPERIENCE_WORK_TYPE}
                  >
                    {getWorkTypeIcon(experience.work_type, {
                      sx: { color: theme.palette.text.secondary, fontSize: TabiyaIconStyles.fontSizeSmall },
                    })}
                    <Typography variant="body1" fontWeight="bold" color={theme.palette.text.secondary}>
                      {getWorkTypeTitle(experience.work_type)}
                    </Typography>
                  </Box>
                </Box>
                <Box display="flex" alignItems="center" justifyContent="flex-end">
                  <PrimaryButton
                    onClick={() => handleRestore(experience)}
                    disableWhenOffline
                    title={t("common.buttons.restore")}
                    data-testid={DATA_TEST_ID.RESTORE_EXPERIENCE_BUTTON}
                    startIcon={<img src={`${process.env.PUBLIC_URL}/restore-icon.svg`} alt={t("common.buttons.restore")} />}
                  >
                    {t("common.buttons.restore")}
                  </PrimaryButton>
                </Box>
              </Box>
              <Typography
                variant="caption"
                sx={{ color: theme.palette.text.secondary }}
                data-testid={DATA_TEST_ID.RESTORE_EXPERIENCE_DATE}
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
          ))}
        </>
      );
    }
  };

  return (
    <Slide direction="left" in={true} appear={true}>
      <Box
        p={4}
        display="flex"
        flexDirection="column"
        gap={theme.fixedSpacing(isSmallMobile ? theme.tabiyaSpacing.lg : theme.tabiyaSpacing.xl)}
        height={"100%"}
        data-testid={DATA_TEST_ID.RESTORE_EXPERIENCES}
      >
        <ExperiencesDrawerHeader notifyOnClose={onClose} title={t("experiences.experiencesDrawer.components.restoreExperiencesDrawer.title")} />
        <Divider />
        {renderContent()}
      </Box>
    </Slide>
  );
};

export default RestoreExperiencesDrawer;
