import React from "react";
import { Box, Container, Divider, Typography, useMediaQuery, useTheme } from "@mui/material";
import type { SxProps } from "@mui/material";
import { useTranslation } from "react-i18next";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { getProductName } from "src/envService";
import { routerPaths } from "src/app/routerPaths";
import type { Theme } from "@mui/material/styles";

const uniqueId = "a7f3d2b1-8e4c-4a9f-b6d5-3c1e2f7a8b9d";

export const DATA_TEST_ID = {
  FOOTER_CONTAINER: `footer-container-${uniqueId}`,
  FOOTER_LOGOS_CONTAINER: `footer-logos-container-${uniqueId}`,
  FOOTER_WORLD_BANK_LOGO: `footer-world-bank-logo-${uniqueId}`,
  FOOTER_MINISTRY_TECH_LOGO: `footer-ministry-tech-logo-${uniqueId}`,
  FOOTER_TABIYA_LOGO: `footer-tabiya-logo-${uniqueId}`,
  FOOTER_PRIVACY_LINK: `footer-privacy-link-${uniqueId}`,
  FOOTER_TERMS_LINK: `footer-terms-link-${uniqueId}`,
  FOOTER_CONTACT_LINK: `footer-contact-link-${uniqueId}`,
  FOOTER_COPYRIGHT: `footer-copyright-${uniqueId}`,
  FOOTER_COLLABORATION: `footer-collaboration-${uniqueId}`,
};

export const EXTERNAL_URLS = {
  CONTACT: "mailto:hi@njila.ai",
};

interface FooterProps {
  sx?: SxProps<Theme>;
}

const Footer: React.FC<FooterProps> = ({ sx }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const appName = getProductName() || "";
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));

  const privacyHref = `${globalThis.location.origin}/#${routerPaths.PRIVACY_POLICY}`;
  const termsHref = `${globalThis.location.origin}/#${routerPaths.TERMS_OF_USE}`;

  return (
    <Box component="footer" data-testid={DATA_TEST_ID.FOOTER_CONTAINER} sx={sx}>
      <Container
        maxWidth={false}
        disableGutters
        sx={{
          width: "100%",
          maxWidth: "var(--layout-content-max-width)",
          marginX: "auto",
          paddingY: theme.fixedSpacing(theme.tabiyaSpacing.lg),
          paddingX: "var(--layout-gutter-x)",
        }}
      >
        <Divider sx={{ borderColor: theme.palette.grey[300], marginBottom: theme.fixedSpacing(isMobile ? 4 : 8) }} />
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
          }}
        >
          {/* Partner logos */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, max-content)" },
              alignItems: "center",
              justifyItems: "center",
              justifyContent: "center",
              columnGap: theme.spacing(theme.tabiyaSpacing.md),
              rowGap: theme.spacing(theme.tabiyaSpacing.md),
              width: "fit-content",
              marginX: "auto",
            }}
            data-testid={DATA_TEST_ID.FOOTER_LOGOS_CONTAINER}
          >
            <Box
              component="img"
              src={`${process.env.PUBLIC_URL}/world-bank-logo.svg`}
              alt={t("home.footer.worldBankLogoAlt")}
              data-testid={DATA_TEST_ID.FOOTER_WORLD_BANK_LOGO}
              sx={{
                height: 28,
                width: "auto",
                objectFit: "contain",
                mr: { xs: 0, sm: theme.fixedSpacing(1.5) },
                mb: { xs: theme.fixedSpacing(1), sm: 0 },
              }}
            />
            <Box
              component="img"
              src={`${process.env.PUBLIC_URL}/ministry-tech.png`}
              alt={t("home.footer.ministryTechLogoAlt")}
              data-testid={DATA_TEST_ID.FOOTER_MINISTRY_TECH_LOGO}
              sx={{
                height: 36,
                width: "auto",
                objectFit: "contain",
              }}
            />
            <Box
              component="img"
              src={`${process.env.PUBLIC_URL}/tabiya-logo.svg`}
              alt={t("home.footer.tabiyaLogoAlt")}
              data-testid={DATA_TEST_ID.FOOTER_TABIYA_LOGO}
              sx={{ height: 46, width: "auto", objectFit: "contain" }}
            />
          </Box>

          {/* Legal links */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: theme.fixedSpacing(theme.tabiyaSpacing.lg),
              flexWrap: "wrap",
            }}
          >
            <CustomLink
              href={privacyHref}
              target="_blank"
              rel="noopener noreferrer"
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
              href={termsHref}
              target="_blank"
              rel="noopener noreferrer"
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
              href={EXTERNAL_URLS.CONTACT}
              target="_blank"
              rel="noopener noreferrer"
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
