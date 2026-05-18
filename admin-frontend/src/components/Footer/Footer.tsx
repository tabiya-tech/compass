import React from "react";
import { Box, Container, Divider, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import CustomLink from "src/theme/CustomLink/CustomLink";
import { getProductName } from "src/envService";
import { getLegalDocumentAbsoluteUrl, LEGAL_DOCUMENT_ROUTE_PATHS } from "src/legal/legalDocumentUrls";
import type { Theme } from "@mui/material/styles";

const uniqueId = "6892e02e-5db5-4750-8cfd-197bb3e654d0";

export const DATA_TEST_ID = {
  FOOTER_CONTAINER: `footer-container-${uniqueId}`,
  FOOTER_LOGOS_CONTAINER: `footer-logos-container-${uniqueId}`,
  FOOTER_WORLD_BANK_LOGO: `footer-world-bank-logo-${uniqueId}`,
  FOOTER_MINISTRY_TECH_LOGO: `footer-ministry-tech-logo-${uniqueId}`,
  FOOTER_TABIYA_LOGO: `footer-tabiya-logo-${uniqueId}`,
  FOOTER_PRIVACY_LINK: `footer-privacy-link-${uniqueId}`,
  FOOTER_TERMS_LINK: `footer-terms-link-${uniqueId}`,
  FOOTER_CONTACT_LINK: `footer-contact-link-${uniqueId}`,
  FOOTER_COLLABORATION: `footer-collaboration-${uniqueId}`,
};

const FOOTER_CONTACT_MAILTO = "mailto:hi@njila.ai";

const Footer: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const { t } = useTranslation();
  const appName = getProductName() || "";
  const privacyHref = getLegalDocumentAbsoluteUrl(LEGAL_DOCUMENT_ROUTE_PATHS.PRIVACY_POLICY);
  const termsHref = getLegalDocumentAbsoluteUrl(LEGAL_DOCUMENT_ROUTE_PATHS.TERMS_OF_USE);

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
            <img
              src={`${process.env.PUBLIC_URL}/world-bank-logo.svg`}
              alt="World Bank Group Logo"
              style={{ height: 28, width: "auto", objectFit: "contain", marginRight: 10 }}
              data-testid={DATA_TEST_ID.FOOTER_WORLD_BANK_LOGO}
            />
            <img
              src={`${process.env.PUBLIC_URL}/ministry-tech.png`}
              alt="Ministry of Technology Logo"
              style={{
                height: 36,
                width: "auto",
                objectFit: "contain",
              }}
              data-testid={DATA_TEST_ID.FOOTER_MINISTRY_TECH_LOGO}
            />
            <img
              src={`${process.env.PUBLIC_URL}/tabiya-logo.svg`}
              alt="Tabiya Logo"
              style={{ height: 46, width: "auto", objectFit: "contain" }}
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
              component="a"
              href={privacyHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={DATA_TEST_ID.FOOTER_PRIVACY_LINK}
              sx={{
                fontSize: "0.8rem",
                fontWeight: 500,
                textDecoration: "none",
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              {t("footer.privacyPolicy")}
            </CustomLink>
            <CustomLink
              component="a"
              href={termsHref}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={DATA_TEST_ID.FOOTER_TERMS_LINK}
              sx={{
                fontSize: "0.8rem",
                fontWeight: 500,
                textDecoration: "none",
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              {t("footer.termsOfUse")}
            </CustomLink>
            <CustomLink
              component="a"
              href={FOOTER_CONTACT_MAILTO}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={DATA_TEST_ID.FOOTER_CONTACT_LINK}
              sx={{
                fontSize: "0.8rem",
                fontWeight: 500,
                textDecoration: "none",
                "&:hover": {
                  textDecoration: "underline",
                },
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
