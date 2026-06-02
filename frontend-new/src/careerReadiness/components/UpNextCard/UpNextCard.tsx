import React, { startTransition, useContext, useState } from "react";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { ModuleSummary } from "src/careerReadiness/types";
import { routerPaths } from "src/app/routerPaths";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

const uniqueId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export const DATA_TEST_ID = {
  UP_NEXT_CARD: `up-next-card-${uniqueId}`,
  UP_NEXT_CARD_CONTINUE: `up-next-card-continue-${uniqueId}`,
};

export interface UpNextCardProps {
  module: ModuleSummary;
}

const UpNextCard: React.FC<UpNextCardProps> = ({ module }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isOnline = useContext(IsOnlineContext);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleContinue = () => {
    if (!isOnline || isNavigating) return;
    setIsNavigating(true);
    startTransition(() => {
      navigate(`${routerPaths.CAREER_READINESS}/${module.id}`);
    });
  };

  return (
    <Box
      data-testid={DATA_TEST_ID.UP_NEXT_CARD}
      sx={{
        border: `1px solid ${theme.palette.tertiary.main}`,
        borderRadius: theme.rounding(theme.tabiyaRounding.sm),
        padding: theme.fixedSpacing(theme.tabiyaSpacing.md),
        backgroundColor: theme.palette.background.paper,
        display: "flex",
        alignItems: { xs: "flex-start", sm: "center" },
        flexDirection: { xs: "column", sm: "row" },
        justifyContent: "space-between",
        gap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
      }}
    >
      <Box>
        <Typography
          sx={{
            ...theme.typography.caption,
            color: theme.palette.text.secondary,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 600,
            marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
          }}
        >
          {t("careerReadiness.upNext")}
        </Typography>
        <Typography
          variant="body1"
          fontWeight={700}
          color="text.primary"
          sx={{ marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.xxs) }}
        >
          {module.title}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: theme.fixedSpacing(theme.tabiyaSpacing.xxs) }}>
          <AccessTimeIcon sx={{ fontSize: 13, color: theme.palette.text.secondary }} />
          <Typography sx={{ ...theme.typography.caption, color: theme.palette.text.secondary }}>
            {t("careerReadiness.takes30Min")}
          </Typography>
        </Box>
      </Box>

      <PrimaryButton
        data-testid={DATA_TEST_ID.UP_NEXT_CARD_CONTINUE}
        onClick={handleContinue}
        color="tertiary"
        showCircle
        disableWhenOffline
        disabled={isNavigating}
        sx={{ flexShrink: 0, fontSize: { xs: "0.75rem", sm: "1rem" } }}
      >
        {isNavigating ? <CircularProgress size={16} color="inherit" /> : t("careerReadiness.continue")}
      </PrimaryButton>
    </Box>
  );
};

export default UpNextCard;
