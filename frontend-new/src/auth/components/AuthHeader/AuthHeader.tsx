import LanguageContextMenu from "src/i18n/languageContextMenu/LanguageContextMenu";
import { Box, Typography } from "@mui/material";
import React from "react";

const uniqueId = "40374529-6e2c-49d8-81d7-93f01603a648";

export const DATA_TEST_ID = {
  AUTH_HEADER_CONTAINER: `auth-header-container-${uniqueId}`,
  AUTH_HEADER_LOGO: `auth-header-logo-${uniqueId}`,
  AUTH_HEADER_TITLE: `auth-header-title-${uniqueId}`,
  AUTH_HEADER_SUBTITLE: `auth-header-title=${uniqueId}`,
};

export interface AuthHeaderProps {
  title: string;
  subtitle: React.ReactElement;
}

const AuthHeader: React.FC<Readonly<AuthHeaderProps>> = ({ title, subtitle }) => {
  return (
    <Box
      data-testid={DATA_TEST_ID.AUTH_HEADER_CONTAINER}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent={"space-evenly"}
    >
      <Box display="flex" flexDirection="row" justifyContent="center" alignItems="center">
        <img
          src={`${process.env.PUBLIC_URL}/logo.svg`}
          alt="Logo"
          style={{ maxWidth: "60%", margin: "5% 10%" }}
          data-testid={DATA_TEST_ID.AUTH_HEADER_LOGO}
        />
        <LanguageContextMenu />
      </Box>
      <Typography variant="h4" gutterBottom data-testid={DATA_TEST_ID.AUTH_HEADER_TITLE}>
        {title}
      </Typography>
      <Typography variant="body2" gutterBottom data-testid={DATA_TEST_ID.AUTH_HEADER_SUBTITLE}>
        {subtitle}
      </Typography>
    </Box>
  );
};

export default AuthHeader;
