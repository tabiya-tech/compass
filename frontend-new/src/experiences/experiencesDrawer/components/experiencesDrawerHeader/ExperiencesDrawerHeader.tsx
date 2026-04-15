import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";

export interface ExperiencesDrawerHeaderProps {
  title: string;
  lastUpdated?: string | null;
  notifyOnClose: () => void;
}

const uniqueId = "4d3ec79b-1a39-4f4b-9c4a-354a5464a253";

export const DATA_TEST_ID = {
  EXPERIENCES_DRAWER_HEADER_CONTAINER: `experiences-drawer-header-container-${uniqueId}`,
  EXPERIENCES_DRAWER_HEADER_BUTTON: `experiences-drawer-header-button-${uniqueId}`,
  EXPERIENCES_DRAWER_HEADER_ICON: `experiences-drawer-header-icon-${uniqueId}`,
  EXPERIENCES_DRAWER_HEADER_TITLE: `experiences-drawer-header-title-${uniqueId}`,
  EXPERIENCES_DRAWER_HEADER_SUBTITLE: `experiences-drawer-header-subtitle-${uniqueId}`,
};

const ExperiencesDrawerHeader: React.FC<ExperiencesDrawerHeaderProps> = (props) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      width="100%"
      position="relative"
      data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_HEADER_CONTAINER}
    >
      <PrimaryIconButton
        sx={{
          color: theme.palette.common.black,
          position: "absolute",
          left: 0,
        }}
        title={t("experiences.experiencesDrawer.components.experiencesDrawerHeader.closeTitle")}
        onClick={props.notifyOnClose}
        data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_HEADER_BUTTON}
      >
        <CloseIcon data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_HEADER_ICON} />
      </PrimaryIconButton>

      <Box display="flex" flexDirection="column" alignItems="center">
        <Typography variant="h5" fontWeight="bold" data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_HEADER_TITLE}>
          {props.title}
        </Typography>
        {props.lastUpdated && (
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.secondary }}
            data-testid={DATA_TEST_ID.EXPERIENCES_DRAWER_HEADER_SUBTITLE}
          >
            Last updated: {new Date(props.lastUpdated).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ExperiencesDrawerHeader;
