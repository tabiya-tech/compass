import React, { useEffect, useMemo, useState } from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import InfoService from "src/info/info.service";
import FeedbackButton from "src/feedback/FeedbackButton";

const uniqueId = "37d307ae-4f1e-4d8d-bafe-fd642f8af4dc";
export const DATA_TEST_ID = {
  INFO_ROOT: `version-${uniqueId}`,
  VERSION_FRONTEND_ROOT: `version-frontend-${uniqueId}`,
  VERSION_BACKEND_ROOT: `version-backend-${uniqueId}`,
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
      <Typography variant="h6" sx={{ minWidth: "100px" }}>
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

const ApplicationInfoMain = (props: { versions: InfoProps[] }) => {
  const theme = useTheme();
  return (
    <Box display="flex" flexDirection="column" gap={theme.tabiyaSpacing.xl}>
      <VersionContainer title="Frontend" info={props.versions[0]} dataTestId={DATA_TEST_ID.VERSION_FRONTEND_ROOT} />
      <VersionContainer title="Backend" info={props.versions[1]} dataTestId={DATA_TEST_ID.VERSION_BACKEND_ROOT} />
    </Box>
  );
};

const Info = () => {
  const [versions, setVersions] = useState<InfoProps[]>([]);
  const infoService = useMemo(() => new InfoService(), []);
  useEffect(() => {
    infoService.loadInfo().then((data) => setVersions(data));
  }, [infoService]);

  return (
    <div style={{ width: "100%", height: "100%" }} data-testid={DATA_TEST_ID.INFO_ROOT}>
      <ApplicationInfoMain versions={versions} />
      <FeedbackButton bottomAlign={true} />
    </div>
  );
};

export default Info;
