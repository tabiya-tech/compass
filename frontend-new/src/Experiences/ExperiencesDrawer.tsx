import React, { useEffect, useState } from "react";
import { Box, Divider, Drawer, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Theme } from "@mui/material/styles";
import ExperiencesDrawerHeader from "src/Experiences/components/ExperiencesDrawerHeader/ExperiencesDrawerHeader";
import ExperiencesDrawerContent, {
  LoadingExperienceDrawerContent,
} from "src/Experiences/components/ExperiencesDrawerContent/ExperiencesDrawerContent";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import { PDFDownloadLink } from "@react-pdf/renderer";
import SkillReport from "src/Report/Report";
import CustomTextField from "src/theme/CustomTextField/CustomTextField";
import CustomAccordion from "src/theme/CustomAccordion/CustomAccordion";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import DownloadReportButton from "src/Experiences/components/DownloadReportButton/DownloadReportButton";

export interface ExperiencesDrawerProps {
  isOpen: boolean;
  notifyOnClose: (event: CloseEvent) => void;
  experiences: Experience[];
  isLoading: boolean;
  conversationCompleted: boolean;
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

const useLocalStorage = (key: string, initialValue: string) => {
  // Retrieve value from localStorage or fallback to initialValue
  const [value, setValue] = useState<string>(() => {
    const savedValue = PersistentStorageService.getItem(PersistentStorageService.local, key);
    const trimmedValueSaved = trimAndValidate(savedValue || "");
    return trimmedValueSaved !== "" ? trimmedValueSaved : initialValue;
  });

  // Update localStorage whenever value changes
  useEffect(() => {
    const trimmedValue = trimAndValidate(value);
    if (trimmedValue !== "") {
      PersistentStorageService.setItem(PersistentStorageService.local, key, trimmedValue);
    } else {
      PersistentStorageService.removeItem(PersistentStorageService.local, key);
    }
  }, [key, value]);

  return [value, setValue] as const;
};

const ExperiencesDrawer: React.FC<ExperiencesDrawerProps> = ({
  isOpen,
  isLoading,
  experiences,
  notifyOnClose,
  conversationCompleted,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const [name, setName] = useLocalStorage("name", "");
  const [phone, setPhone] = useLocalStorage("phone", "");
  const [email, setEmail] = useLocalStorage("email", "");
  const [address, setAddress] = useLocalStorage("address", "");

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
          {conversationCompleted ? (
            <PDFDownloadLink
              document={
                <SkillReport
                  name={trimAndValidate(name)}
                  email={trimAndValidate(email)}
                  phone={trimAndValidate(phone)}
                  address={trimAndValidate(address)}
                  experiences={experiences}
                />
              }
              fileName="SkillReport.pdf"
              style={{ color: theme.palette.tabiyaBlue.main, fontWeight: "bold" }}
            >
              <DownloadReportButton />
            </PDFDownloadLink>
          ) : (
            <DownloadReportButton disabled />
          )}
        </Box>
        <CustomAccordion title="Personal Information" tooltipText={tooltipText}>
          <CustomTextField
            label="Name:"
            placeholder="Enter your name here"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <CustomTextField
            label="Email:"
            placeholder="Enter your email here"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <CustomTextField
            label="Phone:"
            placeholder="Enter your phone number here"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <CustomTextField
            label="Address:"
            placeholder="Enter your address here"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
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
