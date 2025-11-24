import React, { useEffect, useMemo, useState } from "react";
import { Box, Drawer, Skeleton, Typography, useMediaQuery, useTheme } from "@mui/material";
import InfoService from "src/info/info.service";
import PrimaryIconButton from "../theme/PrimaryIconButton/PrimaryIconButton";
import CloseIcon from "@mui/icons-material/Close";
import { Theme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { VersionItem, Versions } from "./info.types";

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

const VersionContainer = ({ dataTestId, title, info }: { dataTestId: string; title: string; info?: VersionItem }) => {
  const theme = useTheme();
    const { t } = useTranslation();

  const versionItems = info
    ? [
        { title: t("info.infoDrawer.versionInfo.date"), value: info.date , skeleton: false},
        { title: t("info.infoDrawer.versionInfo.version"), value: info.branch, skeleton: false },
        { title: t("info.infoDrawer.versionInfo.buildNumber"), value: info.buildNumber, skeleton: false },
        { title: t("info.infoDrawer.versionInfo.gitSha"), value: info.sha, skeleton: false },
      ]
    : [
        { title: t("info.infoDrawer.versionInfo.date"), value: "0000-00-00T00:00:00.000Z", skeleton: true },
        { title: t("info.infoDrawer.versionInfo.version"), value: "foo", skeleton: true },
        { title: t("info.infoDrawer.versionInfo.buildNumber"), value: "000", skeleton: true },
        { title: t("info.infoDrawer.versionInfo.gitSha"), value: "foofoofoofoofoofoofoofoofoofoofoofoofoo", skeleton: true },
      ];
return (
    <Box display="flex" gap={theme.tabiyaSpacing.xl} data-testid={dataTestId}>
      <Typography variant="h6" sx={{ minWidth: "100px", maxWidth: "100px" }}>
        {title}
      </Typography>
      <Box display="flex" flexDirection="column" gap={theme.tabiyaSpacing.sm}>
        {versionItems.map((item) => (
          <VersionInfoItem key={item.title} title={item.title} value={item.value} skeleton={item.skeleton} />
        ))}
      </Box>
    </Box>
  );
};

export interface InfoDrawerProps {
  isOpen: boolean;
  notifyOnClose: (event: CloseEvent) => void;
}

export enum CloseEventName {
  DISMISS = "DISMISS",
}

export type CloseEvent = { name: CloseEventName };

const ApplicationInfoMain = (props: { versions: Partial<Versions> }) => {
  const theme = useTheme();
  const { t } = useTranslation();
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
      <VersionContainer
        title={t("info.infoDrawer.frontendTitle")}
        info={props.versions.frontend}
        dataTestId={DATA_TEST_ID.VERSION_FRONTEND_ROOT}
      />
      <VersionContainer title={t("info.infoDrawer.backendTitle")} info={props.versions.backend} dataTestId={DATA_TEST_ID.VERSION_BACKEND_ROOT} />
    </Box>
  );
};

const InfoDrawer: React.FC<InfoDrawerProps> = ({ isOpen, notifyOnClose }) => {
  const [versions, setVersions] = useState<Partial<Versions>>({ frontend: undefined, backend: undefined });
  const infoService = useMemo(() => InfoService.getInstance(), []);
  const theme = useTheme();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const { t } = useTranslation();

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
        <Typography variant="h5">{t("info.infoDrawer.applicationInformation")}</Typography>
        <PrimaryIconButton
          sx={{
            color: theme.palette.common.black,
            alignSelf: "center",
          }}
          title={t("info.infoDrawer.closeApplicationInformation")}
          onClick={handleClose}
          data-testid={DATA_TEST_ID.INFO_DRAWER_HEADER_BUTTON}
        >
          <CloseIcon data-testid={DATA_TEST_ID.INFO_DRAWER_HEADER_ICON} />
        </PrimaryIconButton>
      </Box>
      <Box data-testid={DATA_TEST_ID.INFO_ROOT}>
        <ApplicationInfoMain versions={versions} />
      </Box>
      <p>T</p>
    </Drawer>
  );
};

export default InfoDrawer;
