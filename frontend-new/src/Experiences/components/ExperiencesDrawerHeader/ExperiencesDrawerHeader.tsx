import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import CloseIcon from "@mui/icons-material/Close";

export interface ExperiencesDrawerHeaderProps {
  notifyOnClose: () => void;
}

const uniqueId = "4d3ec79b-1a39-4f4b-9c4a-354a5464a253";

export const DATA_TEST_ID = {
  EXPERIENCES_DRAWER_HEADER_CONTAINER: `experiences-drawer-header-container-${uniqueId}`,
  EXPERIENCES_DRAWER_HEADER_BUTTON: `experiences-drawer-header-button-${uniqueId}`,
  EXPERIENCES_DRAWER_HEADER_ICON: `experiences-drawer-header-icon-${uniqueId}`,
};

const ExperiencesDrawerHeader: React.FC<ExperiencesDrawerHeaderProps> = (props) => {
  const theme = useTheme();

  return (
    <Box
      display="flex"
      justifyContent="space-between"
      width="100%"
      gap={theme.tabiyaSpacing.lg}
      data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_HEADER_CONTAINER}
    >
      <Typography variant="h5">Experiences and skills</Typography>
      <PrimaryIconButton
        sx={{
          color: theme.palette.common.black,
          alignSelf: "center",
        }}
        title="Close experiences"
        onClick={props.notifyOnClose}
        data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_HEADER_BUTTON}
      >
        <CloseIcon data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_HEADER_ICON} />
      </PrimaryIconButton>
    </Box>
  );
};

export default ExperiencesDrawerHeader;
