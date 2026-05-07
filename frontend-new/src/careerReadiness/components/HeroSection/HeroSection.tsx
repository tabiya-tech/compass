import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { ModuleSummary } from "src/careerReadiness/types";
import UpNextCard from "src/careerReadiness/components/UpNextCard/UpNextCard";
import UpNextCardSkeleton from "src/careerReadiness/components/UpNextCardSkeleton/UpNextCardSkeleton";

const uniqueId = "b2c3d4e5-f6a7-8901-bcde-f12345678901";

export const DATA_TEST_ID = {
  HERO_SECTION: `hero-section-${uniqueId}`,
};

export interface HeroSectionProps {
  upNextModule: ModuleSummary | null;
  loading?: boolean;
}

const HeroSection: React.FC<HeroSectionProps> = ({ upNextModule, loading = false }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Box
      data-testid={DATA_TEST_ID.HERO_SECTION}
      sx={{
        backgroundColor: theme.palette.background.paper,
        width: "100%",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: "var(--layout-content-max-width)",
          margin: "0 auto",
          paddingTop: { xs: 0, sm: theme.fixedSpacing(theme.tabiyaSpacing.sm) },
          paddingBottom: theme.fixedSpacing(theme.tabiyaSpacing.lg),
          paddingLeft: "var(--layout-gutter-x)",
          paddingRight: "var(--layout-gutter-x)",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          gap: theme.fixedSpacing(theme.tabiyaSpacing.lg),
          alignItems: { xs: "flex-start", sm: "center" },
        }}
      >
        <Box
          component="img"
          src="/thinkers.svg"
          alt=""
          sx={{
            width: {
              xs: "100%",
              sm: theme.fixedSpacing(theme.tabiyaSpacing.xl * 8),
            },
            maxWidth: { xs: theme.fixedSpacing(theme.tabiyaSpacing.xl * 8), sm: "none" },
            alignSelf: { xs: "center", sm: "auto" },
            flexShrink: 0,
            display: "block",
            objectFit: "contain",
          }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h3" component="h2" fontWeight="bold" color="text.primary" sx={{ letterSpacing: -0.2 }}>
            {t("careerReadiness.heroTitle")}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.md), lineHeight: 1.6 }}
          >
            {t("careerReadiness.heroDescription")}
          </Typography>
          {loading ? <UpNextCardSkeleton /> : upNextModule && <UpNextCard module={upNextModule} />}
        </Box>
      </Box>
    </Box>
  );
};

export default HeroSection;
