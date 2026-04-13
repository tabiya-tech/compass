import React from "react";
import { Box, Container, Divider, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { getProductName } from "src/envService";
import type { Theme } from "@mui/material/styles";

const uniqueId = "6892e02e-5db5-4750-8cfd-197bb3e654d0";

export const DATA_TEST_ID = {
  FOOTER_CONTAINER: `footer-container-${uniqueId}`,
  FOOTER_LOGOS_CONTAINER: `footer-logos-container-${uniqueId}`,
  FOOTER_WORLD_BANK_LOGO: `footer-world-bank-logo-${uniqueId}`,
  FOOTER_TABIYA_LOGO: `footer-tabiya-logo-${uniqueId}`,
  FOOTER_PRIVACY_LINK: `footer-privacy-link-${uniqueId}`,
  FOOTER_TERMS_LINK: `footer-terms-link-${uniqueId}`,
  FOOTER_CONTACT_LINK: `footer-contact-link-${uniqueId}`,
  FOOTER_COLLABORATION: `footer-collaboration-${uniqueId}`,
};

export const EXTERNAL_URLS = {
  PRIVACY_POLICY: "https://tabiya.org/compass-terms-privacy/#privacy-policy",
  TERMS_OF_USE: "https://tabiya.org/compass-terms-privacy/#terms-and-conditions",
  CONTACT: "mailto:hi@tabiya.org",
};

const Footer: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const { t } = useTranslation();
  const appName = getProductName() || "";

  const handleExternalNavigation = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Box
      component="footer"
      data-testid={DATA_TEST_ID.FOOTER_CONTAINER}
      sx={{
        backgroundColor: theme.palette.containerBackground.light,
        marginTop: isMobile
          ? theme.fixedSpacing(theme.tabiyaSpacing.xl * 1.5)
          : theme.fixedSpacing(theme.tabiyaSpacing.xl * 2),
      }}
    >
      <Divider sx={{ borderColor: theme.palette.grey[300] }} />
      <Container
        maxWidth="md"
        sx={{
          padding: theme.spacing(theme.tabiyaSpacing.lg),
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
              }}
            >
              {t("footer.privacyPolicy")}
            </CustomLink>
            •
            <CustomLink
              onClick={() => handleExternalNavigation(EXTERNAL_URLS.TERMS_OF_USE)}
              data-testid={DATA_TEST_ID.FOOTER_TERMS_LINK}
              sx={{
                fontSize: "0.8rem",
                fontWeight: 500,
              }}
            >
              {t("footer.termsOfUse")}
            </CustomLink>
            •
            <CustomLink
              onClick={() => handleExternalNavigation(EXTERNAL_URLS.CONTACT)}
              data-testid={DATA_TEST_ID.FOOTER_CONTACT_LINK}
              sx={{
                fontSize: "0.8rem",
                fontWeight: 500,
              }}
            >
              {t("footer.contact")}
            </CustomLink>
          </Box>

          <Typography
            color="text.secondary"
            data-testid={DATA_TEST_ID.FOOTER_COLLABORATION}
            sx={{ textAlign: "center", fontSize: "0.7rem" }}
          >
            {t("footer.collaboration", { appName })}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
