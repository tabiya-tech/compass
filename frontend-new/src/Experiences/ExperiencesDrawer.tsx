import React from "react";
import { Box, Drawer, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Theme } from "@mui/material/styles";
import ExperiencesDrawerHeader from "src/Experiences/components/ExperiencesDrawerHeader/ExperiencesDrawerHeader";
import ExperiencesDrawerContent from "src/Experiences/components/ExperiencesDrawerContent/ExperiencesDrawerContent";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";

export interface ExperiencesDrawerProps {
  isOpen: boolean;
  notifyOnClose: (event: CloseEvent) => void;
  experiences: Experience[];
  isLoading: boolean;
}

export enum CloseEventName {
  DISMISS = "DISMISS",
}

export type CloseEvent = { name: CloseEventName };

const uniqueId = "df5ab5c0-a109-4b6d-ba3f-a46975e5511b";

export const DATA_TEST_ID = {
  EXPERIENCES_DRAWER_CONTAINER: `experiences-drawer-container-${uniqueId}`,
};

const ExperiencesDrawer: React.FC<ExperiencesDrawerProps> = ({ isOpen, isLoading, experiences, notifyOnClose }) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const isSmallerScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));

  const handleClose = () => {
    notifyOnClose({ name: CloseEventName.DISMISS });
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: isSmallScreen ? "100%" : "40%",
          padding: isSmallerScreen ? 10 : isSmallScreen ? 6 : theme.tabiyaSpacing.xl,
          gap: isSmallerScreen ? 12 : 8,
        },
      }}
      data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_CONTAINER}
    >
      <ExperiencesDrawerHeader notifyOnClose={handleClose} />
      <Box display="flex" flexDirection="column" gap={isSmallerScreen ? 10 : 6}>
        {experiences.length === 0 && !isLoading && (
          <Box sx={{ fontSize: theme.typography.body1.fontSize, fontWeight: "bold" }}>
            <Typography variant="h1" textAlign={"center"}>
              🤷‍♀️
            </Typography>
            <Typography>
              We haven’t yet discovered any experiences so far, Let's continue chatting.
            </Typography>
          </Box>
        )}
        {experiences.map((experience, index) => (
          <ExperiencesDrawerContent key={index} experience={experience} isLoading={isLoading} />
        ))}
      </Box>
    </Drawer>
  );
};

export default ExperiencesDrawer;
