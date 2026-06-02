import React, { startTransition } from "react";
import { Box, Card, CardActionArea, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ModuleStatusDisplay } from "src/careerReadiness/types";
import type { ModuleSummary } from "src/careerReadiness/types";
import { routerPaths } from "src/app/routerPaths";
import { TranslationKey } from "src/react-i18next";
import FingerprintOutlined from "@mui/icons-material/FingerprintOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import MailOutlineOutlined from "@mui/icons-material/MailOutlineOutlined";
import MicOutlined from "@mui/icons-material/MicOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import HelpOutlineOutlined from "@mui/icons-material/HelpOutlineOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import AutorenewIcon from "@mui/icons-material/Autorenew";

const uniqueId = "a7b8c9d0-e1f2-3a4b-5c6d-7e8f9a0b1c2d";

export const DATA_TEST_ID = {
  MODULE_CARD: `career-readiness-module-card-${uniqueId}`,
  MODULE_CARD_TITLE: `career-readiness-module-card-title-${uniqueId}`,
  MODULE_CARD_DESCRIPTION: `career-readiness-module-card-description-${uniqueId}`,
  MODULE_CARD_ICON: `career-readiness-module-card-icon-${uniqueId}`,
  MODULE_CARD_STATUS: `career-readiness-module-card-status-${uniqueId}`,
};

const MODULE_ICONS: Record<string, React.ReactNode> = {
  identity: <FingerprintOutlined />,
  cv: <DescriptionOutlined />,
  letter: <MailOutlineOutlined />,
  interview: <MicOutlined />,
  workplace: <PeopleOutlined />,
};

export const getModuleIcon = (iconId: string): React.ReactNode => {
  return MODULE_ICONS[iconId] ?? <HelpOutlineOutlined />;
};

const STATUS_ICONS = {
  done: <CheckCircleOutlined sx={{ fontSize: 16 }} />,
  in_progress: <AutorenewIcon sx={{ fontSize: 16 }} />,
};

const getStatusLabel = (status: ModuleStatusDisplay, t: (key: TranslationKey) => string): string => {
  if (status === "done") return t("careerReadiness.statusDone");
  if (status === "in_progress") return t("careerReadiness.statusInProgress");
  return t("careerReadiness.statusUnlocked");
};

const getStatusIcon = (status: ModuleStatusDisplay): React.ReactNode => {
  if (status === "done") return STATUS_ICONS.done;
  if (status === "in_progress") return STATUS_ICONS.in_progress;
  return null;
};

export interface CareerReadinessModuleCardProps {
  module: ModuleSummary;
  status: ModuleStatusDisplay;
}

const useStatusStyles = (status: ModuleStatusDisplay) => {
  const theme = useTheme();

  if (status === "done") {
    return {
      borderColor: theme.palette.tertiary.main,
      iconBg: `color-mix(in srgb, ${theme.palette.tertiary.main} 12%, transparent)`,
      iconColor: theme.palette.tertiary.main,
      statusColor: theme.palette.tertiary.main,
      hoverBorderColor: theme.palette.tertiary.main,
      hoverBg: `color-mix(in srgb, ${theme.palette.tertiary.light} 16%, transparent)`,
    };
  }

  if (status === "in_progress") {
    return {
      borderColor: theme.palette.secondary.main,
      iconBg: `color-mix(in srgb, ${theme.palette.secondary.main} 12%, transparent)`,
      iconColor: theme.palette.secondary.main,
      statusColor: theme.palette.secondary.main,
      hoverBorderColor: theme.palette.secondary.main,
      hoverBg: `color-mix(in srgb, ${theme.palette.secondary.light} 16%, transparent)`,
    };
  }

  // unlocked (not started)
  return {
    borderColor: theme.palette.grey[200],
    iconBg: theme.palette.grey[200],
    iconColor: theme.palette.text.primary,
    statusColor: theme.palette.text.secondary,
    hoverBorderColor: theme.palette.secondary.main,
    hoverBg: `color-mix(in srgb, ${theme.palette.secondary.light} 16%, transparent)`,
  };
};

const CareerReadinessModuleCard: React.FC<CareerReadinessModuleCardProps> = ({ module, status = "unlocked" }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const styles = useStatusStyles(status);

  const handleClick = () => {
    startTransition(() => {
      navigate(`${routerPaths.CAREER_READINESS}/${module.id}`);
    });
  };

  const icon = getModuleIcon(module.icon);

  const statusLabel = getStatusLabel(status, t);
  const statusIcon = getStatusIcon(status);

  return (
    <Card
      sx={{
        borderRadius: theme.rounding(theme.tabiyaRounding.sm),
        border: `1px solid ${styles.borderColor}`,
        boxShadow: "none",
        height: "100%",
        cursor: "pointer",
        "&:hover": {
          borderColor: styles.hoverBorderColor,
          backgroundColor: styles.hoverBg,
        },
      }}
      data-testid={DATA_TEST_ID.MODULE_CARD}
    >
      <CardActionArea
        onClick={handleClick}
        disableRipple
        sx={{
          padding: theme.fixedSpacing(theme.tabiyaSpacing.md),
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            borderRadius: theme.rounding(theme.tabiyaRounding.sm),
            backgroundColor: styles.iconBg,
            color: styles.iconColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: theme.fixedSpacing(theme.tabiyaSpacing.sm),
          }}
          data-testid={DATA_TEST_ID.MODULE_CARD_ICON}
        >
          {icon}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
              mb: theme.tabiyaSpacing.xs,
            }}
          >
            <Typography
              variant="body1"
              color="text.primary"
              fontWeight="bold"
              data-testid={DATA_TEST_ID.MODULE_CARD_TITLE}
              sx={{ lineHeight: 1.3, minWidth: 0 }}
            >
              {module.title}
            </Typography>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                flexShrink: 0,
                color: styles.statusColor,
              }}
              data-testid={DATA_TEST_ID.MODULE_CARD_STATUS}
            >
              {statusIcon}
              <Typography
                sx={{
                  fontWeight: "bold",
                  color: styles.statusColor,
                  whiteSpace: "nowrap",
                  fontSize: "0.75rem",
                }}
              >
                {statusLabel}
              </Typography>
            </Box>
          </Box>

          <Typography variant="body2" color="text.secondary" data-testid={DATA_TEST_ID.MODULE_CARD_DESCRIPTION}>
            {module.description}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default CareerReadinessModuleCard;
