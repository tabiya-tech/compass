import React, { startTransition, useContext, useState } from "react";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { mapModuleStatusToDisplay } from "src/careerReadiness/types";
import type { ModuleSummary } from "src/careerReadiness/types";
import { routerPaths } from "src/app/routerPaths";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

const uniqueId = "c3d4e5f6-a7b8-9012-cdef-123456789012";

export const DATA_TEST_ID = {
  MODULE_ROW: `module-row-${uniqueId}`,
};

export interface ModuleRowProps {
  module: ModuleSummary;
  index: number;
}

const ModuleRow: React.FC<ModuleRowProps> = ({ module, index }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isOnline = useContext(IsOnlineContext);
  const [isNavigating, setIsNavigating] = useState(false);
  const status = mapModuleStatusToDisplay(module.status);
  const isActive = status === "in_progress";
  const isDone = status === "done";

  const handleClick = () => {
    if (!isOnline || isNavigating) return;
    setIsNavigating(true);
    startTransition(() => {
      navigate(`${routerPaths.CAREER_READINESS}/${module.id}`);
    });
  };

  const pillSx = {
    fontSize: theme.typography.caption.fontSize,
    padding: `${theme.fixedSpacing(theme.tabiyaSpacing.xs)} ${theme.fixedSpacing(theme.tabiyaSpacing.sm)}`,
    flexShrink: 0,
    lineHeight: 1.2,
  };

  return (
    <Box
      data-testid={DATA_TEST_ID.MODULE_ROW}
      onClick={handleClick}
      aria-disabled={!isOnline || isNavigating}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
        paddingY: theme.fixedSpacing(theme.tabiyaSpacing.md),
        borderBottom: `1px solid ${theme.palette.divider}`,
        borderColor: theme.palette.secondary.main,
        cursor: isOnline && !isNavigating ? "pointer" : "default",
        "&:last-child": { borderBottom: "none" },
        "&:hover": { opacity: isOnline && !isNavigating ? 0.8 : 1 },
      }}
    >
      <Box
        sx={{
          width: theme.fixedSpacing(theme.tabiyaSpacing.md * 1.75),
          height: theme.fixedSpacing(theme.tabiyaSpacing.md * 1.75),
          borderRadius: "50%",
          border: `2px solid ${theme.palette.careerReadiness.main}`,
          backgroundColor: isDone ? theme.palette.careerReadiness.main : "transparent",
          color: isDone ? theme.palette.careerReadiness.contrastText : theme.palette.careerReadiness.main,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontFamily: theme.typography.caption.fontFamily,
          fontSize: theme.typography.caption.fontSize,
          lineHeight: 1,
          fontWeight: 700,
        }}
      >
        {index + 1}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} color="text.primary">
          {module.title}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
            marginTop: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
          }}
        >
          <HourglassEmptyIcon
            sx={{
              fontSize: 16,
              color: theme.palette.text.secondary,
              stroke: "currentColor",
              strokeWidth: 1,
            }}
          />
          <Typography sx={{ ...theme.typography.caption, color: theme.palette.text.secondary, fontWeight: 500 }}>
            {t("careerReadiness.approx30Min")}
          </Typography>
        </Box>
      </Box>

      {isActive && (
        <PrimaryButton color="careerReadiness" disableWhenOffline disabled={isNavigating} sx={pillSx}>
          {isNavigating ? <CircularProgress size={14} color="inherit" /> : `${t("careerReadiness.continue")} →`}
        </PrimaryButton>
      )}
      {!isActive && !isDone && (
        <PrimaryButton
          variant="outlined"
          color="careerReadiness"
          disableWhenOffline
          disabled={isNavigating}
          sx={pillSx}
        >
          {isNavigating ? <CircularProgress size={14} color="inherit" /> : t("careerReadiness.chat")}
        </PrimaryButton>
      )}
      {isDone && (
        <PrimaryButton color="careerReadiness" disableWhenOffline disabled={isNavigating} sx={pillSx}>
          {isNavigating ? <CircularProgress size={14} color="inherit" /> : t("careerReadiness.statusDone")}
        </PrimaryButton>
      )}
    </Box>
  );
};

export default ModuleRow;
