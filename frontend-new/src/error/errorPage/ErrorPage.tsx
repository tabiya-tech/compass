import { Box, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import BugReportButton from "src/feedback/bugReport/bugReportButton/BugReportButton";
import { getLogoUrl } from "src/envService";

const uniqueId = "37d307ae-4f1e-4d8d-bafe-fd642f8af4ab";

export const DATA_TEST_ID = {
  ERROR_CONTAINER: `error-${uniqueId}}`,
  ERROR_ILLUSTRATION: `error-illustration-${uniqueId}}`,
  ERROR_MESSAGE: `error-message-${uniqueId}`,
};

interface ErrorPageProps {
  errorMessage: string;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ errorMessage }) => {
  const { t } = useTranslation();

  const logoUrlFromEnv = getLogoUrl();
  const logoSrc = logoUrlFromEnv || `${process.env.PUBLIC_URL}/logo.svg`;

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
      data-testid={DATA_TEST_ID.ERROR_CONTAINER}
    >
      <img
        src={logoSrc}
        alt={t("error.errorPage.illustrationAlt")}
        width="250px"
        data-testid={DATA_TEST_ID.ERROR_ILLUSTRATION}
        style={{ marginBottom: "2rem" }}
      />
      <Typography variant="h2" data-testid={DATA_TEST_ID.ERROR_MESSAGE}>
        {errorMessage}
      </Typography>
      <BugReportButton bottomAlign={true} />
    </Box>
  );
};

export default ErrorPage;
