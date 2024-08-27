import React, { useEffect, useState } from "react";
import { Box, Divider, Drawer, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Theme } from "@mui/material/styles";
import ExperiencesDrawerHeader from "src/Experiences/components/ExperiencesDrawerHeader/ExperiencesDrawerHeader";
import ExperiencesDrawerContent, {
  LoadingExperienceDrawerContent,
} from "src/Experiences/components/ExperiencesDrawerContent/ExperiencesDrawerContent";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import CustomTextField from "src/theme/CustomTextField/CustomTextField";
import CustomAccordion from "src/theme/CustomAccordion/CustomAccordion";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import DownloadReportButton from "src/Experiences/components/DownloadReportButton/DownloadReportButton";

export interface ExperiencesDrawerProps {
  isOpen: boolean;
  notifyOnClose: (event: CloseEvent) => void;
  experiences: Experience[];
  isLoading: boolean;
  conversationCompletedAt: string | null;
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

const trimAndValidate = (value: string) => {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? "" : trimmedValue;
};

const useLocalStorage = (key: string, initialValue: Record<string, string>) => {
  // Retrieve value from localStorage or fallback to initialValue
  const [value, setValue] = useState<Record<string, string>>(() => {
    const savedValue = PersistentStorageService.getItem(PersistentStorageService.storage, key);
    const parsedValue = savedValue ? JSON.parse(savedValue) : initialValue;
    return Object.fromEntries(
      Object.entries(parsedValue).map(([fieldName, fieldValue]) => [fieldName, trimAndValidate(fieldValue as string)])
    );
  });

  useEffect(() => {
    const validatedValue = Object.fromEntries(
      Object.entries(value).map(([fieldName, fieldValue]) => [fieldName, trimAndValidate(fieldValue)])
    );

    PersistentStorageService.setItem(PersistentStorageService.storage, key, JSON.stringify(validatedValue));
  }, [key, value]);

  return [value, setValue] as const;
};

const ExperiencesDrawer: React.FC<ExperiencesDrawerProps> = ({
  isOpen,
  isLoading,
  experiences,
  notifyOnClose,
  conversationCompletedAt,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const [personalInfo, setPersonalInfo] = useLocalStorage("personalInfo", {
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [hasTopSkills, setHasTopSkills] = useState(false);

  useEffect(() => {
    setHasTopSkills(experiences.some((experience) => experience.top_skills && experience.top_skills.length > 0));
  }, [experiences]);

  const validatedPersonalInfo = Object.fromEntries(
    Object.entries(personalInfo).map(([fieldName, fieldValue]) => [fieldName, trimAndValidate(fieldValue)])
  );

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setPersonalInfo({ ...personalInfo, [field]: e.target.value });
  };

  const handleClose = () => {
    notifyOnClose({ name: CloseEventName.DISMISS });
  };

  const tooltipText = "We don’t save these information. The information you provide will only be used for the report.";
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
          <DownloadReportButton
            name={validatedPersonalInfo.name}
            email={validatedPersonalInfo.email}
            phone={validatedPersonalInfo.phone}
            address={validatedPersonalInfo.address}
            experiences={experiences}
            conversationCompletedAt={conversationCompletedAt!}
            disabled={!hasTopSkills}
          />
        </Box>
        <CustomAccordion title="Personal Information" tooltipText={tooltipText}>
          <CustomTextField
            label="Name:"
            placeholder="Enter your name here"
            value={personalInfo.name}
            onChange={handleInputChange("name")}
          />
          <CustomTextField
            label="Email:"
            placeholder="Enter your email here"
            value={personalInfo.email}
            onChange={handleInputChange("email")}
          />
          <CustomTextField
            label="Phone:"
            placeholder="Enter your phone number here"
            value={personalInfo.phone}
            onChange={handleInputChange("phone")}
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
          {!isLoading &&
            experiences.map((experience, index) => <ExperiencesDrawerContent key={index} experience={experience} />)}
        </Box>
      </Box>
    </Drawer>
  );
};

export default ExperiencesDrawer;
