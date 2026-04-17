import React from "react";

import { Box, useMediaQuery, useTheme } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import Footer from "src/home/components/Footer/Footer";
import HomeHero from "src/home/components/HomeHero/HomeHero";
import HomeCtaGrid from "src/home/components/HomeCtaGrid/HomeCtaGrid";
import HomeJobReadyList from "src/home/components/HomeJobReadyList/HomeJobReadyList";
import HomeSidebar from "src/home/components/Sidebar/HomeSidebar";
import { useUserProfile } from "src/profile/hooks/useUserProfile";

const uniqueId = "f1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c";

export const DATA_TEST_ID = {
  HOME_CONTAINER: `home-container-${uniqueId}`,
  HOME_MAIN_COLUMN: `home-main-column-${uniqueId}`,
  HOME_DASHBOARD_GRID: `home-dashboard-grid-${uniqueId}`,
};

const Home: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));
  const { profileData, isLoadingModules, errors } = useUserProfile();

  const modulesLoadError = Boolean(errors?.modules);
  const careerReadinessModules = profileData?.modules ?? [];

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: theme.palette.containerBackground.main,
        overflowX: "hidden",
        overflowY: "auto",
      }}
      data-testid={DATA_TEST_ID.HOME_CONTAINER}
    >
      <Box
        data-testid={DATA_TEST_ID.HOME_MAIN_COLUMN}
        sx={{
          flex: 1,
          minWidth: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            backgroundColor: theme.palette.common.white,
            paddingTop: isMobile
              ? theme.fixedSpacing(theme.tabiyaSpacing.lg)
              : theme.fixedSpacing(theme.tabiyaSpacing.md),
            paddingBottom: { xs: theme.fixedSpacing(theme.tabiyaSpacing.sm), md: 0 },
            overflow: "visible",
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: "var(--layout-content-max-width)",
              mx: "auto",
              px: "var(--layout-gutter-x)",
            }}
          >
            <HomeHero />
          </Box>
        </Box>

        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            marginTop: {
              xs: 0,
              md: theme.spacing(-3),
              lg: theme.spacing(-4),
            },
            paddingBottom: theme.fixedSpacing(theme.tabiyaSpacing.lg),
          }}
        >
          <HomeCtaGrid />
        </Box>

        <Box
          data-testid={DATA_TEST_ID.HOME_DASHBOARD_GRID}
          sx={{
            width: "100%",
            flex: 1,
            backgroundColor: theme.palette.containerBackground.main,
            paddingTop: theme.fixedSpacing(theme.tabiyaSpacing.xl),
            paddingBottom: theme.fixedSpacing(isMobile ? 8 : 12),
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: "var(--layout-content-max-width)",
              mx: "auto",
              px: "var(--layout-gutter-x)",
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 2fr) minmax(0, 1fr)" },
              columnGap: { xs: 0, md: theme.fixedSpacing(10) },
              rowGap: { xs: theme.fixedSpacing(6), md: 0 },
              alignItems: "start",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <HomeJobReadyList
                modules={careerReadinessModules}
                isLoading={isLoadingModules}
                loadError={modulesLoadError}
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <HomeSidebar />
            </Box>
          </Box>
        </Box>
      </Box>

      <Footer />
    </Box>
  );
};

export default Home;
