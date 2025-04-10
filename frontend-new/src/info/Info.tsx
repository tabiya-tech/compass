import React, { useEffect, useMemo, useState } from "react";
import { Box, Drawer, Skeleton, Typography, useMediaQuery, useTheme } from "@mui/material";
import InfoService from "src/info/info.service";
import PrimaryIconButton from "../theme/PrimaryIconButton/PrimaryIconButton";
import CloseIcon from "@mui/icons-material/Close";
import { Theme } from "@mui/material/styles";

const uniqueId = "37d307ae-4f1e-4d8d-bafe-fd642f8af4dc";
export const DATA_TEST_ID = {
  INFO_ROOT: `version-${uniqueId}`,
  VERSION_FRONTEND_ROOT: `version-frontend-${uniqueId}`,
  VERSION_BACKEND_ROOT: `version-backend-${uniqueId}`,
  INFO_DRAWER_CONTAINER: `version-drawer-${uniqueId}`,
  INFO_DRAWER_HEADER: `version-drawer-header-${uniqueId}`,
  INFO_DRAWER_HEADER_BUTTON: `version-drawer-header-button-${uniqueId}`,
  INFO_DRAWER_HEADER_ICON: `version-drawer-header-icon-${uniqueId}`,
};

const VersionInfoItem = ({ title, value, skeleton }: { title: string; value: string; skeleton?: boolean }) => {
  return (
    <Box>
      <Typography variant="h6">{title}</Typography>
      <Typography variant="body1">
        {skeleton ? <Skeleton>{value.replace(/./g, "\u00A0\u00A0")}</Skeleton> : value}
      </Typography>
    </Box>
  );
};

const VersionContainer = ({ dataTestId, title, info }: { dataTestId: string; title: string; info: InfoProps }) => {
  const theme = useTheme();
  return (
    <Box display="flex" gap={theme.tabiyaSpacing.xl} data-testid={dataTestId}>
      <Typography variant="h6" sx={{ minWidth: "100px", maxWidth: "100px" }}>
        {title}
      </Typography>
      {info ? (
        <Box display="flex" flexDirection="column" gap={theme.tabiyaSpacing.sm}>
          <VersionInfoItem title="Date" value={info.date} />
          <VersionInfoItem title="Version" value={info.branch} />
          <VersionInfoItem title="Build Number" value={info.buildNumber} />
          <VersionInfoItem title="GIT SHA" value={info.sha} />
        </Box>
      ) : (
        <Box display="flex" flexDirection="column" gap={theme.tabiyaSpacing.sm}>
          <VersionInfoItem title="Date" value={"0000-00-00T00:00:00.000Z"} skeleton={true} />
          <VersionInfoItem title="Version" value={"foo"} skeleton={true} />
          <VersionInfoItem title="Build Number" value={"000"} skeleton={true} />
          <VersionInfoItem title="GIT SHA" value={"foofoofoofoofoofoofoofoofoofoofoofoofoo"} skeleton={true} />
        </Box>
      )}
    </Box>
  );
};

export interface InfoProps {
  date: string;
  branch: string;
  buildNumber: string;
  sha: string;
}

export interface InfoDrawerProps {
  isOpen: boolean;
  notifyOnClose: (event: CloseEvent) => void;
}

export enum CloseEventName {
  DISMISS = "DISMISS",
}

export type CloseEvent = { name: CloseEventName };

const ApplicationInfoMain = (props: { versions: InfoProps[] }) => {
  const theme = useTheme();
  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={theme.tabiyaSpacing.xl}
      tabIndex={0}
      sx={{
        width: "100%",
        overflowX: "auto",
      }}
    >
      <VersionContainer title="Frontend" info={props.versions[0]} dataTestId={DATA_TEST_ID.VERSION_FRONTEND_ROOT} />
      <VersionContainer title="Backend" info={props.versions[1]} dataTestId={DATA_TEST_ID.VERSION_BACKEND_ROOT} />
    </Box>
  );
};

const InfoDrawer: React.FC<InfoDrawerProps> = ({ isOpen, notifyOnClose }) => {
  const [versions, setVersions] = useState<InfoProps[]>([]);
  const infoService = useMemo(() => new InfoService(), []);
  const theme = useTheme();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));

  useEffect(() => {
    if (isOpen) {
      infoService.loadInfo().then((data) => setVersions(data));
    }
  }, [infoService, isOpen]);

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
          width: isMobile ? "100%" : "40%",
          padding: theme.tabiyaSpacing.xl,
          gap: theme.fixedSpacing(theme.tabiyaSpacing.lg),
        },
      }}
      data-testid={DATA_TEST_ID.INFO_DRAWER_CONTAINER}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: theme.tabiyaSpacing.md }}
        data-testid={DATA_TEST_ID.INFO_DRAWER_HEADER}
      >
        <Typography variant="h5">Application Information</Typography>
        <PrimaryIconButton
          sx={{
            color: theme.palette.common.black,
            alignSelf: "center",
          }}
          title="Close application information"
          onClick={handleClose}
          data-testid={DATA_TEST_ID.INFO_DRAWER_HEADER_BUTTON}
        >
          <CloseIcon data-testid={DATA_TEST_ID.INFO_DRAWER_HEADER_ICON} />
        </PrimaryIconButton>
      </Box>
      <Box data-testid={DATA_TEST_ID.INFO_ROOT}>
        <ApplicationInfoMain versions={versions} />
      </Box>
    </Drawer>
  );
};

export default InfoDrawer;
