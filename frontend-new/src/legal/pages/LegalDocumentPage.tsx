import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Box, Container, Typography, useTheme } from "@mui/material";
import MarkdownReader from "src/knowledgeHub/components/MarkdownReader/MarkdownReader";
import { getDarkLogoUrl, getLogoUrl, getProductName } from "src/envService";
import { getLegalDocument } from "src/legal/legalDocumentLoader";
import type { LegalDocumentVariant } from "src/legal/legalDocumentLoader";
import { routerPaths } from "src/app/routerPaths";

const uniqueId = "b2c9e1a4-6f3d-4b8e-9c2a-1d5e7f0a4b6c";

export const DATA_TEST_ID = {
  LEGAL_PAGE_CONTAINER: `legal-page-container-${uniqueId}`,
  LEGAL_PAGE_LOGO: `legal-page-logo-${uniqueId}`,
  LEGAL_PAGE_TITLE: `legal-page-title-${uniqueId}`,
  LEGAL_PAGE_BODY: `legal-page-body-${uniqueId}`,
};

export interface LegalDocumentPageProps {
  variant: LegalDocumentVariant;
}

const applyAppNamePlaceholders = (text: string, appName: string): string => text.replaceAll("{{appName}}", appName);

const LegalDocumentPage: React.FC<LegalDocumentPageProps> = ({ variant }) => {
  const theme = useTheme();
  const appName = getProductName();

  const { title, markdown } = useMemo(() => getLegalDocument(variant), [variant]);
  const markdownWithAppName = useMemo(() => applyAppNamePlaceholders(markdown, appName), [markdown, appName]);

  const logoUrlFromEnv = getDarkLogoUrl() || getLogoUrl();
  const logoSrc = logoUrlFromEnv || `${process.env.PUBLIC_URL}/njila-logo-dark.svg`;

  return (
    <Box
      component="main"
      data-testid={DATA_TEST_ID.LEGAL_PAGE_CONTAINER}
      sx={{
        minHeight: "100vh",
        backgroundColor: theme.palette.containerBackground.main,
        py: theme.spacing(theme.tabiyaSpacing.lg),
        px: "var(--layout-gutter-x)",
      }}
    >
      <Container
        maxWidth="md"
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: theme.spacing(theme.tabiyaSpacing.md),
        }}
      >
        <Link to={routerPaths.ROOT} aria-label="Go back">
          <Box
            component="img"
            src={logoSrc}
            alt={appName}
            data-testid={DATA_TEST_ID.LEGAL_PAGE_LOGO}
            sx={{ maxWidth: "70%", width: "auto", height: "auto", objectFit: "contain", alignSelf: "flex-start" }}
          />
        </Link>

        <Typography variant="h2" textAlign="center" data-testid={DATA_TEST_ID.LEGAL_PAGE_TITLE}>
          {title}
        </Typography>

        <Box data-testid={DATA_TEST_ID.LEGAL_PAGE_BODY}>
          <MarkdownReader content={markdownWithAppName} headingEmphasis />
        </Box>
      </Container>
    </Box>
  );
};

export default LegalDocumentPage;
