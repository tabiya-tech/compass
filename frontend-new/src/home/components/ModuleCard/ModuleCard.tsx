import React, { startTransition } from "react";
import { Box, Card, CardActionArea, Typography, Chip, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Module } from "src/home/modulesService";
import { TranslationKey } from "src/react-i18next";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import ExploreOutlined from "@mui/icons-material/ExploreOutlined";
import HelpOutlineOutlined from "@mui/icons-material/HelpOutlineOutlined";
import { getProductName } from "src/envService";
import { BADGE_STATUS, BadgeStatus } from "src/home/constants";

const uniqueId = "c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f";

export const DATA_TEST_ID = {
  MODULE_CARD: `module-card-${uniqueId}`,
  MODULE_CARD_ICON: `module-card-icon-${uniqueId}`,
  MODULE_CARD_TITLE: `module-card-title-${uniqueId}`,
  MODULE_CARD_DESCRIPTION: `module-card-description-${uniqueId}`,
  MODULE_CARD_CONTINUE_CHIP: `module-card-continue-chip-${uniqueId}`,
  MODULE_CARD_COMPLETED_CHIP: `module-card-completed-chip-${uniqueId}`,
  MODULE_CARD_SOON_CHIP: `module-card-soon-chip-${uniqueId}`,
};

export interface ModuleCardProps {
  module: Module;
  badgeStatus?: BadgeStatus;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  skills_discovery: <AutoAwesomeOutlined sx={{ fontSize: 40 }} />,
  job_readiness: <SchoolOutlined sx={{ fontSize: 40 }} />,
  career_explorer: <SearchOutlined sx={{ fontSize: 40 }} />,
  knowledge_hub: <MenuBookOutlined sx={{ fontSize: 40 }} />,
  job_matching: <ExploreOutlined sx={{ fontSize: 40 }} />,
};

const ModuleCard: React.FC<ModuleCardProps> = ({ module, badgeStatus = null }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const appName = getProductName();

  const handleClick = () => {
    if (module.disabled) {
      return;
    }
    startTransition(() => {
      navigate(module.route);
    });
  };

  const icon = MODULE_ICONS[module.id] || <HelpOutlineOutlined sx={{ fontSize: 40 }} />;
  const isDisabled = module.disabled === true;

  return (
    <Card
      sx={{
        borderRadius: theme.rounding(theme.tabiyaRounding.sm),
        border: `1px solid ${theme.palette.common.black}`,
        boxShadow: "none",
        height: "100%",
        position: "relative",
        opacity: isDisabled ? 0.6 : 1,
        "&:hover": {
          borderColor: isDisabled ? theme.palette.common.black : theme.palette.secondary.main,
          backgroundColor: isDisabled
            ? "transparent"
            : `color-mix(in srgb, ${theme.palette.secondary.light} 16%, transparent)`,
        },
      }}
      data-testid={DATA_TEST_ID.MODULE_CARD}
    >
      <CardActionArea
        onClick={handleClick}
        disableRipple
        disabled={isDisabled}
        sx={{
          padding: theme.spacing(theme.tabiyaSpacing.lg),
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        {/* Badge (Continue, Completed, or Soon) */}
        {badgeStatus && (
          <Box sx={{ position: "absolute", top: 12, right: 12 }}>
            <Chip
              label={
                badgeStatus === BADGE_STATUS.CONTINUE
                  ? t("home.modules.continue")
                  : badgeStatus === BADGE_STATUS.COMPLETED
                    ? t("home.modules.completed")
                    : t("home.modules.soon")
              }
              size="small"
              data-testid={
                badgeStatus === BADGE_STATUS.CONTINUE
                  ? DATA_TEST_ID.MODULE_CARD_CONTINUE_CHIP
                  : badgeStatus === BADGE_STATUS.COMPLETED
                    ? DATA_TEST_ID.MODULE_CARD_COMPLETED_CHIP
                    : DATA_TEST_ID.MODULE_CARD_SOON_CHIP
              }
              sx={{
                backgroundColor:
                  badgeStatus === BADGE_STATUS.CONTINUE
                    ? theme.palette.secondary.main
                    : badgeStatus === BADGE_STATUS.COMPLETED
                      ? theme.palette.success.main
                      : theme.palette.grey[600],
                color:
                  badgeStatus === BADGE_STATUS.CONTINUE
                    ? theme.palette.secondary.contrastText
                    : badgeStatus === BADGE_STATUS.COMPLETED
                      ? theme.palette.success.contrastText
                      : theme.palette.common.white,
                fontWeight: "bold",
                fontSize: "0.75rem",
              }}
            />
          </Box>
        )}

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: theme.tabiyaSpacing.sm,
            width: "100%",
          }}
        >
          {/* Icon */}
          <Box
            sx={{
              color: isDisabled ? theme.palette.text.disabled : theme.palette.text.primary,
            }}
            data-testid={DATA_TEST_ID.MODULE_CARD_ICON}
          >
            {icon}
          </Box>

          {/* Title */}
          <Typography
            variant="body1"
            color={isDisabled ? "text.disabled" : "text.primary"}
            fontWeight="bold"
            data-testid={DATA_TEST_ID.MODULE_CARD_TITLE}
          >
            {t(module.labelKey as TranslationKey)}
          </Typography>

          {/* Description */}
          <Typography
            variant="body2"
            color={isDisabled ? "text.disabled" : "text.secondary"}
            data-testid={DATA_TEST_ID.MODULE_CARD_DESCRIPTION}
          >
            {t(module.descriptionKey as TranslationKey, { appName })}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export default ModuleCard;
