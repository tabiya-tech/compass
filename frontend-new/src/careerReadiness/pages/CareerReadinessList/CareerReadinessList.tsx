import React from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { Theme } from "@mui/material/styles";
import { isConnectionError } from "src/error/restAPIError/isConnectionError";
import Footer from "src/home/components/Footer/Footer";
import HomeSidebar from "src/home/components/Sidebar/HomeSidebar";
import HeroSection from "src/careerReadiness/components/HeroSection/HeroSection";
import ModuleRow from "src/careerReadiness/components/ModuleRow/ModuleRow";
import ModuleRowSkeleton from "src/careerReadiness/components/ModuleRowSkeleton/ModuleRowSkeleton";
import { useUserProfileContext } from "src/profile/UserProfileContext";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

const uniqueId = "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a";

export const DATA_TEST_ID = {
  CAREER_READINESS_LIST_CONTAINER: `career-readiness-list-container-${uniqueId}`,
  CAREER_READINESS_LIST_CONTENT: `career-readiness-list-content-${uniqueId}`,
  CAREER_READINESS_MODULES_LIST: `career-readiness-modules-list-${uniqueId}`,
  CAREER_READINESS_LIST_EMPTY: `career-readiness-list-empty-${uniqueId}`,
};

const CareerReadinessList: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));

  // Read modules from shared context — already fetched by UserProfileProvider on layout mount
  const { profileData, isLoadingModules, errors } = useUserProfileContext();
  const modules = [...profileData.modules].sort((a, b) => a.sort_order - b.sort_order);
  const loading = isLoadingModules;
  const modulesLoadError = Boolean(errors?.modules);
  const modulesConnectionError = isConnectionError(errors?.modules);
  const modulesErrorMessage = modulesConnectionError
    ? t("common.errors.api.serverConnectionError")
    : t("error.errorPage.defaultMessage");

  const upNextModule =
    modules.find((m) => m.status === "IN_PROGRESS") ??
    modules.find((m) => m.status === "UNLOCKED") ??
    modules[0] ??
    null;

  const renderModulesListContent = (): React.ReactNode => {
    if (loading) {
      return Array.from({ length: 5 }).map((_, i) => <ModuleRowSkeleton key={i} />);
    }

    if (modulesLoadError) {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          <Typography variant="body1" color="error.main">
            {modulesErrorMessage}
          </Typography>
          <PrimaryButton onClick={() => globalThis.location.reload()}>
            {t("error.errorPage.refreshButton")}
          </PrimaryButton>
        </Box>
      );
    }

    if (modules.length === 0) {
      return (
        <Typography variant="body1" color="error" data-testid={DATA_TEST_ID.CAREER_READINESS_LIST_EMPTY}>
          {t("careerReadiness.emptyList")}
        </Typography>
      );
    }

    return modules.map((module, i) => <ModuleRow key={module.id} module={module} index={i} />);
  };

  return (
    <Box display="flex" flexDirection="column" flex={1} data-testid={DATA_TEST_ID.CAREER_READINESS_LIST_CONTAINER}>
      <HeroSection upNextModule={upNextModule} loading={loading} />

      <Box
        sx={{
          flex: 1,
          backgroundColor: theme.palette.containerBackground.main,
          paddingBottom: theme.fixedSpacing(8),
        }}
        data-testid={DATA_TEST_ID.CAREER_READINESS_LIST_CONTENT}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: "var(--layout-content-max-width)",
            mx: "auto",
            px: "var(--layout-gutter-x)",
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: "stretch",
            gap: theme.fixedSpacing(isMobile ? theme.tabiyaSpacing.lg : theme.tabiyaSpacing.xl * 2),
          }}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              paddingTop: theme.fixedSpacing(theme.tabiyaSpacing.lg),
              paddingBottom: theme.fixedSpacing(theme.tabiyaSpacing.lg),
            }}
          >
            <Typography
              sx={{
                ...theme.typography.h2,
                fontWeight: 700,
                fontSize: "1.5rem",
                lineHeight: 0.9,
                letterSpacing: "-0.02em",
                color: theme.palette.text.secondary,
                marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.md),
              }}
            >
              {t("careerReadiness.modulesTitle")}
            </Typography>

            <Box data-testid={DATA_TEST_ID.CAREER_READINESS_MODULES_LIST}>{renderModulesListContent()}</Box>
          </Box>

          <Box
            sx={{
              width: { xs: "100%", md: 320 },
              flexShrink: 0,
              paddingTop: theme.fixedSpacing(isMobile ? theme.tabiyaSpacing.xs : theme.tabiyaSpacing.lg),
            }}
          >
            <HomeSidebar showViewCvButton={false} />
          </Box>
        </Box>
      </Box>
      <Footer sx={{ backgroundColor: theme.palette.containerBackground.main }} />
    </Box>
  );
};

export default CareerReadinessList;
