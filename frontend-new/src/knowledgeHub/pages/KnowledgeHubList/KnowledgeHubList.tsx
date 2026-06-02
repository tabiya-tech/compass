import React, { startTransition, useContext, useMemo } from "react";
import { Box, Stack, Typography, useTheme } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { getSectorsForApp } from "src/knowledgeHub/components/SectorProfile/sectorStaticData";
import { getProductName } from "src/envService";
import { routerPaths } from "src/app/routerPaths";
import Footer from "src/home/components/Footer/Footer";
import BackLink from "src/navigation/BackLink/BackLink";

const uniqueId = "b3d4e5f6-7890-abcd-ef12-345678901234";

export const DATA_TEST_ID = {
  KNOWLEDGE_HUB_LIST_CONTAINER: `knowledge-hub-list-container-${uniqueId}`,
  KNOWLEDGE_HUB_LIST_CONTENT: `knowledge-hub-list-content-${uniqueId}`,
  KNOWLEDGE_HUB_HERO: `knowledge-hub-hero-${uniqueId}`,
  KNOWLEDGE_HUB_SECTOR_LIST: `knowledge-hub-sector-list-${uniqueId}`,
  KNOWLEDGE_HUB_SECTOR_ITEM: `knowledge-hub-sector-item-${uniqueId}`,
  KNOWLEDGE_HUB_BACK_LINK: `knowledge-hub-back-link-${uniqueId}`,
};

const getSectorIconSrc = (sector: string): string => `${process.env.PUBLIC_URL}/${sector}.svg`;

const KnowledgeHubList: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isOnline = useContext(IsOnlineContext);

  const sectors = useMemo(() => getSectorsForApp(getProductName()), []);

  const handleDocumentClick = (id: string) => {
    if (!isOnline) return;
    startTransition(() => {
      navigate(`${routerPaths.KNOWLEDGE_HUB}/${id}`);
    });
  };

  const contentColumnSx = {
    width: "100%",
    maxWidth: "var(--layout-content-max-width)",
    mx: "auto",
    textAlign: "left" as const,
    px: "var(--layout-gutter-x)",
  };

  const textAlignGrid = {
    display: "grid",
    gridTemplateColumns: {
      xs: "minmax(40px, 52px) minmax(0, 1fr)",
      sm: "minmax(48px, 56px) minmax(0, 1fr)",
      md: "250px minmax(0, 1fr)",
    },
    columnGap: { xs: theme.fixedSpacing(3), sm: theme.fixedSpacing(4), md: theme.fixedSpacing(6) },
    alignItems: "flex-start",
    width: "100%",
  } as const;

  return (
    <Box
      display="flex"
      flexDirection="column"
      minHeight="100vh"
      sx={{ backgroundColor: theme.palette.pageBackground.main }}
      data-testid={DATA_TEST_ID.KNOWLEDGE_HUB_LIST_CONTAINER}
    >
      <Box
        component="main"
        sx={{ flex: 1, width: "100%", display: "flex", flexDirection: "column" }}
        data-testid={DATA_TEST_ID.KNOWLEDGE_HUB_LIST_CONTENT}
      >
        <Box
          sx={{
            width: "100%",
            backgroundColor: theme.palette.common.white,
            overflow: "visible",
            pt: theme.fixedSpacing(theme.tabiyaSpacing.lg),
            pb: theme.fixedSpacing(6),
            position: "relative",
            zIndex: 1,
          }}
        >
          <Box sx={{ ...contentColumnSx, overflow: "visible" }}>
            <Box sx={{ mb: theme.fixedSpacing(theme.tabiyaSpacing.lg) }}>
              <BackLink
                label={t("home.backToDashboard")}
                isOnline={isOnline}
                onClick={() => {
                  startTransition(() => {
                    navigate(routerPaths.ROOT);
                  });
                }}
                dataTestId={DATA_TEST_ID.KNOWLEDGE_HUB_BACK_LINK}
                color={theme.palette.primary.main}
                sx={{ opacity: isOnline ? 1 : 0.5 }}
              />
            </Box>
            <Box
              data-testid={DATA_TEST_ID.KNOWLEDGE_HUB_HERO}
              sx={{
                ...textAlignGrid,
                gridTemplateColumns: { xs: "1fr", md: "250px minmax(0, 1fr)" },
                rowGap: { xs: theme.fixedSpacing(2), md: 0 },
                position: "relative",
                overflow: "visible",
              }}
            >
              <Box
                component="img"
                src={`${process.env.PUBLIC_URL}/runner.svg`}
                alt=""
                sx={{
                  display: { xs: "block", md: "none" },
                  width: "auto",
                  height: "auto",
                  maxWidth: { xs: 240 },
                  mx: "auto",
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: "relative",
                  minWidth: 0,
                  alignSelf: "stretch",
                  overflow: "visible",
                  display: { xs: "none", md: "block" },
                  mb: { md: theme.fixedSpacing(-10) },
                }}
              >
                <Box
                  component="img"
                  src={`${process.env.PUBLIC_URL}/runner.svg`}
                  alt=""
                  sx={{
                    position: "absolute",
                    left: { md: 0 },
                    top: { md: -20 },
                    width: { md: 250 },
                    height: { md: 290 },
                    opacity: 1,
                    display: "block",
                    zIndex: 2,
                    pointerEvents: "none",
                  }}
                />
              </Box>
              <Box sx={{ minWidth: 0, position: "relative", zIndex: 2 }}>
                <Typography
                  variant="h2"
                  sx={{
                    fontWeight: 800,
                    mb: theme.fixedSpacing(1),
                    color: theme.palette.text.primary,
                  }}
                >
                  {t("knowledgeHub.heroTitlePrefix")}
                  <span style={{ color: theme.palette.primary.main }}>:</span>
                  <br />
                  {t("knowledgeHub.heroTitleQuestion")}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: theme.palette.text.primary,
                    fontSize: { xs: "0.95rem", md: "1rem" },
                  }}
                >
                  {t("knowledgeHub.introduction")}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            flex: 1,
            width: "100%",
            backgroundColor: theme.palette.pageBackground.main,
            position: "relative",
            zIndex: 0,
            pt: theme.fixedSpacing(8),
            pb: theme.fixedSpacing(16),
          }}
        >
          <Box sx={contentColumnSx}>
            <Stack spacing={theme.fixedSpacing(6)} data-testid={DATA_TEST_ID.KNOWLEDGE_HUB_SECTOR_LIST}>
              {sectors.map((staticData) => {
                const sectorKey = staticData.sector;
                const titleKey = `knowledgeHub.sectors.${sectorKey}.title`;
                const descriptionKey = `knowledgeHub.sectors.${sectorKey}.description`;
                const iconSrc = getSectorIconSrc(sectorKey);
                const displayName = t(titleKey as any);
                const discoverLabel = displayName.toLowerCase();
                const pathwayId = `${sectorKey}-pathway`;

                return (
                  <Box
                    key={pathwayId}
                    sx={textAlignGrid}
                    data-testid={`${DATA_TEST_ID.KNOWLEDGE_HUB_SECTOR_ITEM}-${pathwayId}`}
                  >
                    <Box
                      component="img"
                      src={iconSrc}
                      alt=""
                      aria-hidden
                      sx={{
                        width: { xs: "100%", md: "auto" },
                        maxWidth: { md: 56 },
                        height: { xs: "auto", md: 56 },
                        objectFit: "contain",
                        display: "block",
                        justifySelf: { md: "end" },
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h3" sx={{ color: theme.palette.text.primary }}>
                        {displayName}
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          mt: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                          color: theme.palette.text.primary,
                        }}
                      >
                        {t(descriptionKey as any, { defaultValue: staticData.description })}
                      </Typography>
                      <Typography
                        component="button"
                        type="button"
                        disabled={!isOnline}
                        aria-disabled={!isOnline}
                        onClick={() => handleDocumentClick(pathwayId)}
                        sx={{
                          mt: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                          border: 0,
                          p: 0,
                          cursor: isOnline ? "pointer" : "default",
                          opacity: isOnline ? 1 : 0.5,
                          background: "transparent",
                          color: theme.palette.primary.main,
                          fontWeight: 600,
                          fontSize: "0.95rem",
                          textAlign: "left",
                          display: "inline-block",
                          "&:hover:not(:disabled)": { textDecoration: "underline" },
                        }}
                      >
                        {t("knowledgeHub.discoverSectorCta", { sector: discoverLabel })}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Stack>

            {sectors.length === 0 && (
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                py={theme.fixedSpacing(theme.tabiyaSpacing.xl * 2)}
              >
                <Typography variant="body1" color="text.secondary">
                  {t("knowledgeHub.noDocumentsAvailable")}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
      <Footer sx={{ backgroundColor: theme.palette.pageBackground.main }} />
    </Box>
  );
};

export default KnowledgeHubList;
