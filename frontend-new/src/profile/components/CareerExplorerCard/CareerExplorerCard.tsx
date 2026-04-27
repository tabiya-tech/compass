import React, { startTransition, useContext } from "react";
import { Box, Typography, Skeleton, useTheme } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { routerPaths } from "src/app/routerPaths";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import type { TranslationKey } from "src/react-i18next";
import type { UserSectorEngagementItem } from "src/careerExplorer/services/CareerExplorerService";

const uniqueId = "career-explorer-card-d1e2f3a4-5b6c-7d8e-9f0a-1b2c3d4e5f6a";

export const DATA_TEST_ID = {
  CARD: `career-explorer-card-${uniqueId}`,
  TITLE: `career-explorer-title-${uniqueId}`,
  SECTOR_ITEM: (index: number) => `career-explorer-sector-${index}-${uniqueId}`,
};

export interface CareerExplorerCardProps {
  sectors: UserSectorEngagementItem[];
  isLoading: boolean;
}

type PathwaySlug = "mining" | "energy" | "agriculture" | "hospitality" | "water";

const PATHWAY_TITLE_KEYS: Record<PathwaySlug, TranslationKey> = {
  mining: "home.profile.pathways.mining.title",
  energy: "home.profile.pathways.energy.title",
  agriculture: "home.profile.pathways.agriculture.title",
  hospitality: "home.profile.pathways.hospitality.title",
  water: "home.profile.pathways.water.title",
};

const PATHWAY_DESCRIPTION_KEYS: Record<PathwaySlug, TranslationKey> = {
  mining: "home.profile.pathways.mining.description",
  energy: "home.profile.pathways.energy.description",
  agriculture: "home.profile.pathways.agriculture.description",
  hospitality: "home.profile.pathways.hospitality.description",
  water: "home.profile.pathways.water.description",
};

const ALL_SECTORS: readonly {
  id: string;
  slug: PathwaySlug;
  emoji: string;
  bg: string;
}[] = [
  { id: "mining-pathway", slug: "mining", emoji: "⛏️", bg: "secondary.light" },
  { id: "energy-pathway", slug: "energy", emoji: "⚡️", bg: "info.light" },
  { id: "agriculture-pathway", slug: "agriculture", emoji: "🌾", bg: "success.light" },
  { id: "hospitality-pathway", slug: "hospitality", emoji: "🏨", bg: "brandAction.light" },
  { id: "water-pathway", slug: "water", emoji: "💧", bg: "primary.light" },
];
export const CareerExplorerCard: React.FC<CareerExplorerCardProps> = ({ sectors: _sectors, isLoading }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isOnline = useContext(IsOnlineContext);

  const handleBrowseAll = () => {
    if (!isOnline) return;
    startTransition(() => {
      navigate(routerPaths.KNOWLEDGE_HUB);
    });
  };

  const handlePathwayNavigate = (pathwayId: string) => {
    if (!isOnline) return;
    startTransition(() => {
      navigate(`${routerPaths.KNOWLEDGE_HUB}/${pathwayId}`);
    });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: theme.fixedSpacing(theme.tabiyaSpacing.sm) }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Typography
          variant="h4"
          data-testid={DATA_TEST_ID.TITLE}
          sx={{
            color: theme.palette.text.primary,
            fontWeight: 700,
          }}
        >
          {t("home.profile.careerPathways")}
        </Typography>
        <Typography
          component="button"
          type="button"
          disabled={!isOnline}
          onClick={handleBrowseAll}
          variant="body2"
          color="brandAction"
          sx={{
            fontWeight: "bold",
            background: "none",
            border: "none",
            cursor: isOnline ? "pointer" : "default",
            opacity: isOnline ? 1 : 0.5,
            "&:hover:not(:disabled)": { textDecoration: "underline" },
          }}
        >
          {t("home.profile.browseAllPathways")}
        </Typography>
      </Box>

      <Box
        sx={{
          borderRadius: theme.rounding(theme.tabiyaRounding.md),
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          padding: theme.fixedSpacing(theme.tabiyaSpacing.lg),
        }}
        data-testid={DATA_TEST_ID.CARD}
      >
        {isLoading ? (
          <Box sx={{ p: theme.fixedSpacing(theme.tabiyaSpacing.lg), display: "flex", flexDirection: "column", gap: 2 }}>
            {[1, 2, 3].map((i) => (
              <Box key={i} sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <Skeleton variant="circular" width={48} height={48} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="30%" height={24} />
                  <Skeleton variant="text" width="60%" height={20} />
                </Box>
                <Skeleton variant="rounded" width={100} height={40} sx={{ borderRadius: 999 }} />
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {ALL_SECTORS.map((sector, index) => {
              const isLast = index === ALL_SECTORS.length - 1;

              return (
                <Box
                  key={sector.id}
                  onClick={isOnline ? () => handlePathwayNavigate(sector.id) : undefined}
                  aria-disabled={!isOnline}
                  data-testid={DATA_TEST_ID.SECTOR_ITEM(index)}
                  sx={{
                    cursor: isOnline ? "pointer" : "default",
                    opacity: isOnline ? 1 : 0.5,
                    display: "flex",
                    alignItems: "center",
                    gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
                    py: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                    borderBottom: isLast ? "none" : `1px solid ${theme.palette.divider}`,
                    "&:hover": { backgroundColor: isOnline ? theme.palette.action.hover : "transparent" },
                  }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: theme.rounding(theme.tabiyaRounding.md),
                      backgroundColor: sector.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Typography fontSize="1.5rem">{sector.emoji}</Typography>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight="bold" color="text.primary">
                      {t(PATHWAY_TITLE_KEYS[sector.slug])}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      {t(PATHWAY_DESCRIPTION_KEYS[sector.slug])}
                    </Typography>
                  </Box>
                  <Box sx={{ flexShrink: 0, ml: 2, display: "flex", alignItems: "center" }}>
                    <ChevronRightIcon sx={{ color: theme.palette.text.secondary }} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
};
