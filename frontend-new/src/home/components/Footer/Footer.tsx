import React from "react";
import { Box, Container, Divider, Typography, useTheme } from "@mui/material";
import type { SxProps } from "@mui/material";
import { useTranslation } from "react-i18next";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { getProductName } from "src/envService";
import type { Theme } from "@mui/material/styles";

const uniqueId = "a7f3d2b1-8e4c-4a9f-b6d5-3c1e2f7a8b9d";

export const DATA_TEST_ID = {
  FOOTER_CONTAINER: `footer-container-${uniqueId}`,
  FOOTER_LOGOS_CONTAINER: `footer-logos-container-${uniqueId}`,
  FOOTER_WORLD_BANK_LOGO: `footer-world-bank-logo-${uniqueId}`,
  FOOTER_TABIYA_LOGO: `footer-tabiya-logo-${uniqueId}`,
  FOOTER_PRIVACY_LINK: `footer-privacy-link-${uniqueId}`,
  FOOTER_TERMS_LINK: `footer-terms-link-${uniqueId}`,
  FOOTER_ACCESSIBILITY_LINK: `footer-accessibility-link-${uniqueId}`,
  FOOTER_CONTACT_LINK: `footer-contact-link-${uniqueId}`,
  FOOTER_COPYRIGHT: `footer-copyright-${uniqueId}`,
  FOOTER_COLLABORATION: `footer-collaboration-${uniqueId}`,
};

export const EXTERNAL_URLS = {
  PRIVACY_POLICY: "https://tabiya.org/compass-terms-privacy/#privacy-policy",
  TERMS_OF_USE: "https://tabiya.org/compass-terms-privacy/#terms-and-conditions",
  ACCESSIBILITY: "https://tabiya.org/compass-terms-privacy/#accessibility",
  CONTACT: "mailto:hi@tabiya.org",
};

interface FooterProps {
  sx?: SxProps<Theme>;
}

const Footer: React.FC<FooterProps> = ({ sx }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const appName = getProductName() || "";

  const handleExternalNavigation = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Box component="footer" data-testid={DATA_TEST_ID.FOOTER_CONTAINER} sx={sx}>
      <Divider sx={{ borderColor: theme.palette.grey[300] }} />
      <Container
        maxWidth={false}
        sx={{
          width: "100%",
          maxWidth: "var(--layout-content-max-width)",
          marginX: "auto",
          paddingTop: theme.spacing(theme.tabiyaSpacing.lg),
          paddingBottom: theme.spacing(theme.tabiyaSpacing.lg),
          paddingX: "var(--layout-gutter-x)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: theme.spacing(theme.tabiyaSpacing.md),
          }}
        >
          {/* Partner logos */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: theme.spacing(theme.tabiyaSpacing.lg),
            }}
            data-testid={DATA_TEST_ID.FOOTER_LOGOS_CONTAINER}
          >
            <img
              src={`${process.env.PUBLIC_URL}/world-bank-logo.svg`}
              alt="World Bank Group Logo"
              style={{ maxWidth: "40%" }}
              data-testid={DATA_TEST_ID.FOOTER_WORLD_BANK_LOGO}
            />
            <img
              src={`${process.env.PUBLIC_URL}/tabiya-logo.svg`}
              alt="Tabiya Logo"
              style={{ maxWidth: "35%" }}
              data-testid={DATA_TEST_ID.FOOTER_TABIYA_LOGO}
            />
          </Box>

          {/* Legal links */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: theme.spacing(theme.tabiyaSpacing.md),
              flexWrap: "wrap",
            }}
          >
            <CustomLink
              onClick={() => handleExternalNavigation(EXTERNAL_URLS.PRIVACY_POLICY)}
              data-testid={DATA_TEST_ID.FOOTER_PRIVACY_LINK}
              sx={{
                fontSize: "0.8rem",
                fontWeight: 500,
                textDecoration: "None",
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              {t("home.footer.privacyPolicy")}
            </CustomLink>
            <CustomLink
              onClick={() => handleExternalNavigation(EXTERNAL_URLS.TERMS_OF_USE)}
              data-testid={DATA_TEST_ID.FOOTER_TERMS_LINK}
              sx={{
                fontSize: "0.8rem",
                fontWeight: 500,
                textDecoration: "None",
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              {t("home.footer.termsOfUse")}
            </CustomLink>
            <CustomLink
              onClick={() => handleExternalNavigation(EXTERNAL_URLS.ACCESSIBILITY)}
              data-testid={DATA_TEST_ID.FOOTER_ACCESSIBILITY_LINK}
              sx={{
                fontSize: "0.8rem",
                fontWeight: 500,
                textDecoration: "None",
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              {t("home.footer.accessibility")}
            </CustomLink>
            <CustomLink
              onClick={() => handleExternalNavigation(EXTERNAL_URLS.CONTACT)}
              data-testid={DATA_TEST_ID.FOOTER_CONTACT_LINK}
              sx={{
                fontSize: "0.8rem",
                fontWeight: 500,
                textDecoration: "None",
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              {t("home.footer.contact")}
            </CustomLink>
          </Box>

          {/* Collaboration text */}
          <Typography
            color="text.secondary"
            data-testid={DATA_TEST_ID.FOOTER_COLLABORATION}
            sx={{ textAlign: "center", fontSize: "0.7rem" }}
          >
            {t("home.footer.collaboration", { appName })}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
