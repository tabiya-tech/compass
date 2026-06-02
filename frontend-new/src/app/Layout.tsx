import React, { useMemo } from "react";
import { Box } from "@mui/material";
import { Outlet, useMatches } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TranslationKey } from "src/react-i18next";
import NavBar from "src/navigation/NavBar/NavBar";
import SubNavBar from "src/navigation/SubNavBar/SubNavBar";
import { UserProfileProvider } from "src/profile/UserProfileContext";
import { ExperiencesDrawerProvider } from "src/experiences/ExperiencesDrawerProvider";
import { RebuildProfileProvider } from "src/chat/RebuildProfileContext";

export interface RouteHandle {
  title?: string;
  subtitle?: string;
  headerColor?: string;
  backLabelKey?: string;
  backTo?: string;
}

const Layout: React.FC = () => {
  const matches = useMatches();
  const { t } = useTranslation();

  const { currentHandle, headerColor } = useMemo(() => {
    let handleWithTitle: RouteHandle | undefined;
    let firstHeaderColor: string | undefined;

    for (let i = matches.length - 1; i >= 0; i--) {
      const routeHandle = matches[i].handle as RouteHandle | undefined;
      if (!routeHandle) continue;

      if (!handleWithTitle && routeHandle.title) {
        handleWithTitle = routeHandle;
      }

      if (!firstHeaderColor && routeHandle.headerColor) {
        firstHeaderColor = routeHandle.headerColor;
      }

      if (handleWithTitle && firstHeaderColor) break;
    }

    return {
      currentHandle: handleWithTitle,
      headerColor: handleWithTitle?.headerColor ?? firstHeaderColor ?? "primary",
    };
  }, [matches]);

  return (
    <UserProfileProvider>
      <RebuildProfileProvider>
        <ExperiencesDrawerProvider>
          <Box
            display="flex"
            flexDirection="column"
            height="100vh"
            sx={(theme) => ({
              "--layout-content-max-width": "80rem",
              "--layout-gutter-x": {
                xs: theme.fixedSpacing(theme.tabiyaSpacing.md),
                md: theme.spacing(theme.tabiyaSpacing.xl),
              },
            })}
          >
            <Box sx={{ flexShrink: 0 }}>
              <NavBar headerColor={headerColor} />
              {currentHandle?.title && currentHandle?.subtitle && (
                <SubNavBar
                  title={t(currentHandle.title as TranslationKey)}
                  subtitle={t(currentHandle.subtitle as TranslationKey)}
                  headerColor={headerColor}
                  backLabelKey={currentHandle.backLabelKey as TranslationKey | undefined}
                  backTo={currentHandle.backTo}
                />
              )}
            </Box>
            <Box display="flex" flexDirection="column" flex={1} minHeight={0}>
              <Outlet />
            </Box>
          </Box>
        </ExperiencesDrawerProvider>
      </RebuildProfileProvider>
    </UserProfileProvider>
  );
};

export default Layout;
