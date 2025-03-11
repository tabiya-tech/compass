import { useEffect, useMemo, useState, Suspense } from "react";
import { Box, Divider, Drawer, Typography, useMediaQuery, useTheme } from "@mui/material";
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
import ExperienceCategory from "src/experiences/experiencesDrawer/components/experienceCategory/ExperienceCategory";
import { lazyWithPreload } from "src/utils/preloadableComponent/PreloadableComponent";
import DownloadReportButton from "./components/downloadReportButton/DownloadReportButton";
const LazyLoadedDownloadDropdown = lazyWithPreload(() => import("src/experiences/experiencesDrawer/components/downloadReportDropdown/DownloadReportDropdown"));

export interface ExperiencesDrawerProps {
  isOpen: boolean;
  notifyOnClose: (event: CloseEvent) => void;
  experiences: Experience[];
  isLoading: boolean;
  conversationConductedAt: string | null;
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

const DisabledDownloadReportButton = () => {
  return (
    <DownloadReportButton
      notifyOnDownloadPdf={() => {}}
      disabled={true}
    />
  )
}

const ExperiencesDrawer: React.FC<ExperiencesDrawerProps> = ({
  isOpen,
  isLoading,
  experiences,
  notifyOnClose,
  conversationConductedAt,
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

  useEffect(() => {
    setHasTopSkills(experiences.some((experience) => experience.top_skills && experience.top_skills.length > 0));
  }, [experiences]);

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setPersonalInfo({ ...personalInfo, [field]: e.target.value });
  };

  const handleClose = () => {
    notifyOnClose({ name: CloseEventName.DISMISS });
  };

  // Experiences with top skills
  const experiencesWithTopSkills = useMemo(
    () => experiences.filter((experience) => experience.top_skills && experience.top_skills.length > 0),
    [experiences]
  );

  // Group experiences by work type
  const groupedExperiences = useMemo(() => groupExperiencesByWorkType(experiences), [experiences]);

  const getDownloadReportDropdown = () => {
    if(experiences.length){
      return <LazyLoadedDownloadDropdown
        name={personalInfo.fullName}
        email={personalInfo.contactEmail}
        phone={personalInfo.phoneNumber}
        address={personalInfo.address}
        experiences={experiencesWithTopSkills}
        conversationConductedAt={conversationConductedAt!}
        disabled={!hasTopSkills}
      />
    }
    return <DisabledDownloadReportButton />
  }

  const tooltipText =
    "The fields are prefilled with information you may have provided earlier and are stored securely on your device. Fill in missing details to personalize your CV.";
  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: isMobile ? "100%" : "40%",
          padding: isSmallMobile ? 10 : isMobile ? 6 : theme.tabiyaSpacing.xl,
          gap: isSmallMobile ? 12 : 4,
        },
      }}
      data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTAINER}
    >
      <ExperiencesDrawerHeader notifyOnClose={handleClose} />
      <Box display="flex" flexDirection="column" gap={2}>
        <Box display="flex" flexDirection="column" gap={1} alignItems="end" justifyContent="flex-end">
          <Suspense fallback={<DisabledDownloadReportButton />}>
            {getDownloadReportDropdown()}
          </Suspense>
        </Box>
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
              <Typography>We haven’t yet discovered any experiences so far, Let's continue chatting.</Typography>
            </Box>
          )}

          {/* EXPERIENCES */}
          {!isLoading && (
            <Box display="flex" flexDirection="column" gap={isSmallMobile ? 10 : 6}>
              <ExperienceCategory
                icon={<StoreIcon />}
                title={ReportContent.SELF_EMPLOYMENT_TITLE}
                experiences={groupedExperiences.selfEmploymentExperiences}
              />
              <ExperienceCategory
                icon={<WorkIcon />}
                title={ReportContent.SALARY_WORK_TITLE}
                experiences={groupedExperiences.salaryWorkExperiences}
              />
              <ExperienceCategory
                icon={<VolunteerActivismIcon />}
                title={ReportContent.UNPAID_WORK_TITLE}
                experiences={groupedExperiences.unpaidWorkExperiences}
              />
              <ExperienceCategory
                icon={<SchoolIcon />}
                title={ReportContent.TRAINEE_WORK_TITLE}
                experiences={groupedExperiences.traineeWorkExperiences}
              />
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default ExperiencesDrawer;
