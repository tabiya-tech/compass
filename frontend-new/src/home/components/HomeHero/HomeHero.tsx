import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { getProductName } from "src/envService";

const uniqueId = "5cbaec73-1f15-4a92-9189-ff57c0202545";

export const DATA_TEST_ID = {
  HOME_HERO: `home-hero-${uniqueId}`,
  HOME_HERO_HEADLINE: `home-hero-headline-${uniqueId}`,
  HOME_HERO_BODY: `home-hero-body-${uniqueId}`,
  HOME_HERO_ILLUSTRATION: `home-hero-illustration-${uniqueId}`,
};

const HomeHero: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const appName = getProductName() || "";

  return (
    <Box
      component="section"
      data-testid={DATA_TEST_ID.HOME_HERO}
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "flex-end" },
        gap: { xs: theme.fixedSpacing(theme.tabiyaSpacing.md), sm: theme.fixedSpacing(theme.tabiyaSpacing.lg) },
        overflow: "visible",
        position: "relative",
      }}
    >
      <Box sx={{ flex: { sm: "1 1 48%" }, minWidth: 0, alignSelf: { sm: "center" } }}>
        <Typography
          variant="h1"
          color="text.primary"
          data-testid={DATA_TEST_ID.HOME_HERO_HEADLINE}
          sx={{ marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.xs) }}
        >
          {t("home.hero.headline1")}
          <Box component="span" sx={{ color: theme.palette.brandAction.main }}>
            .
          </Box>
        </Typography>
        <Typography
          variant="h1"
          sx={{
            color: theme.palette.primary.main,
            marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.md),
          }}
        >
          {t("home.hero.headline2")}
        </Typography>
        <Typography variant="body1" data-testid={DATA_TEST_ID.HOME_HERO_BODY}>
          {t("home.hero.body", { appName })}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: { sm: "1 1 52%" },
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          position: "relative",
          zIndex: 2,
        }}
      >
        <Box
          component="img"
          src="/path.svg"
          alt={t("home.hero.illustrationAlt")}
          data-testid={DATA_TEST_ID.HOME_HERO_ILLUSTRATION}
          sx={{
            width: "100%",
            maxWidth: { xs: 320, sm: 480, md: 560 },
            height: "auto",
            maxHeight: { xs: 240, sm: 320, md: 380 },
            display: "block",
            objectFit: "contain",
            objectPosition: "bottom center",
            pointerEvents: "none",
            marginBottom: { xs: theme.fixedSpacing(theme.tabiyaSpacing.md), sm: 0 },
          }}
        />
      </Box>
    </Box>
  );
};

export default HomeHero;
