import React, { startTransition, useContext, useState } from "react";
import { Box, CircularProgress, Divider, Typography, useMediaQuery, useTheme } from "@mui/material";
import { Theme } from "@mui/material/styles";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TranslationKey } from "src/react-i18next";
import { routerPaths } from "src/app/routerPaths";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { mapModuleStatusToDisplay } from "src/careerReadiness/types";
import type { ModuleSummary } from "src/careerReadiness/types";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";

function getJobReadyLearningLabel(isDone: boolean, isInProgress: boolean, t: (key: TranslationKey) => string): string {
  if (isDone) return t("home.jobReadySection.completedLearning");
  return t(isInProgress ? "home.jobReadySection.continueLearning" : "home.jobReadySection.startLearning");
}

function getJobReadyPrimaryCtaLabel(
  isDone: boolean,
  isInProgress: boolean,
  t: (key: TranslationKey) => string
): string | null {
  if (isDone) return t("home.jobReadySection.viewModule");
  return t(isInProgress ? "home.jobReadySection.continueProfileChat" : "home.jobReadySection.startChat");
}

function shouldShowRowDivider(
  index: number,
  currentModuleId: string,
  sorted: ModuleSummary[],
  expandedModuleId: string | null
): boolean {
  return (
    index < sorted.length - 1 && currentModuleId !== expandedModuleId && sorted[index + 1]?.id !== expandedModuleId
  );
}

interface JobReadyListRowProps {
  module: ModuleSummary;
  moduleIndex: number;
  sorted: ModuleSummary[];
  expandedModuleId: string | null;
  setExpandedModuleId: React.Dispatch<React.SetStateAction<string | null>>;
  rowTestIdPrefix: string;
}

const JobReadyListRow: React.FC<JobReadyListRowProps> = ({
  module,
  moduleIndex,
  sorted,
  expandedModuleId,
  setExpandedModuleId,
  rowTestIdPrefix,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isOnline = useContext(IsOnlineContext);
  const [isNavigating, setIsNavigating] = useState(false);
  const isSmallMobile = useMediaQuery((th: Theme) => th.breakpoints.down("sm"));
  const secondary = theme.palette.secondary;

  const n = moduleIndex + 1;
  const isExpanded = module.id === expandedModuleId;
  const statusDisplay = mapModuleStatusToDisplay(module.status);
  const isDone = statusDisplay === "done";
  const isInProgress = statusDisplay === "in_progress";
  const isUnlocked = statusDisplay === "unlocked";

  const learningLabel = getJobReadyLearningLabel(isDone, isInProgress, t);
  const primaryCtaLabel = getJobReadyPrimaryCtaLabel(isDone, isInProgress, t);

  const goToModule = (id: string) => {
    if (!isOnline || isNavigating) return;
    setIsNavigating(true);
    startTransition(() => {
      navigate(`${routerPaths.CAREER_READINESS}/${id}`);
    });
  };

  return (
    <Box component="li">
      {isExpanded ? (
        <Box
          data-testid={`${rowTestIdPrefix}-${module.id}`}
          sx={{
            border: `2px solid ${secondary.main}`,
            borderRadius: theme.rounding(theme.tabiyaRounding.sm),
            padding: {
              xs: theme.fixedSpacing(theme.tabiyaSpacing.md),
              sm: theme.fixedSpacing(theme.tabiyaSpacing.lg),
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: {
                xs: theme.fixedSpacing(theme.tabiyaSpacing.md),
                md: theme.fixedSpacing(theme.tabiyaSpacing.xl),
              },
            }}
          >
            <Box
              sx={{
                width: theme.fixedSpacing(isSmallMobile ? theme.tabiyaSpacing.xl * 1.2 : theme.tabiyaSpacing.xl * 1.5),
                height: theme.fixedSpacing(isSmallMobile ? theme.tabiyaSpacing.xl * 1.2 : theme.tabiyaSpacing.xl * 1.5),
                borderRadius: "50%",
                bgcolor: secondary.main,
                color: secondary.contrastText,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                flexShrink: 0,
                fontSize: isSmallMobile ? "1.5rem" : "2rem",
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {n}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="caption"
                color="text.primary"
                letterSpacing="0.08em"
                sx={{
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.md),
                }}
              >
                {learningLabel}
              </Typography>
              <Typography
                variant="body1"
                fontWeight="bold"
                color="text.primary"
                sx={{
                  lineHeight: 1.2,
                  marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                }}
              >
                {module.title}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
                  color: theme.palette.text.secondary,
                }}
              >
                <HourglassEmptyIcon
                  sx={{
                    color: "inherit",
                    fontSize: 18,
                    stroke: "currentColor",
                    strokeWidth: 1,
                  }}
                />
                <Typography variant="caption" color="inherit" fontWeight={500}>
                  {t("careerReadiness.takes30Min")}
                </Typography>
              </Box>
              {primaryCtaLabel !== null && (
                <PrimaryButton
                  color="secondary"
                  showCircle
                  disableWhenOffline
                  disabled={isNavigating}
                  onClick={() => goToModule(module.id)}
                  sx={{
                    alignSelf: "flex-start",
                    marginTop: theme.fixedSpacing(theme.tabiyaSpacing.lg),
                  }}
                >
                  {isNavigating ? <CircularProgress size={16} color="inherit" /> : primaryCtaLabel}
                </PrimaryButton>
              )}
            </Box>
          </Box>
        </Box>
      ) : (
        <Box
          data-testid={`${rowTestIdPrefix}-${module.id}`}
          onClick={() => setExpandedModuleId(module.id)}
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            gap: {
              xs: theme.fixedSpacing(theme.tabiyaSpacing.sm),
              sm: theme.fixedSpacing(theme.tabiyaSpacing.lg),
            },
            py: {
              xs: theme.fixedSpacing(theme.tabiyaSpacing.sm),
              sm: theme.fixedSpacing(theme.tabiyaSpacing.md),
            },
            cursor: "pointer",
            borderRadius: theme.rounding(theme.tabiyaRounding.sm),
          }}
        >
          <Box
            sx={{
              width: theme.fixedSpacing(theme.tabiyaSpacing.xl),
              height: theme.fixedSpacing(theme.tabiyaSpacing.xl),
              borderRadius: "50%",
              border: `2px solid ${secondary.main}`,
              color: isDone ? secondary.contrastText : secondary.main,
              bgcolor: isDone ? secondary.main : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              flexShrink: 0,
              alignSelf: "center",
            }}
          >
            {n}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body1"
              fontWeight={700}
              color="text.primary"
              sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
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
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              minWidth: "fit-content",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {isInProgress && (
              <PrimaryButton
                color="secondary"
                disableWhenOffline
                disabled={isNavigating}
                onClick={() => goToModule(module.id)}
                sx={{
                  fontSize: theme.typography.caption.fontSize,
                  padding: `${theme.fixedSpacing(theme.tabiyaSpacing.xs)} ${theme.fixedSpacing(theme.tabiyaSpacing.sm)}`,
                  flexShrink: 0,
                  lineHeight: 1.2,
                }}
              >
                {isNavigating ? <CircularProgress size={14} color="inherit" /> : `${t("careerReadiness.continue")} →`}
              </PrimaryButton>
            )}
            {isUnlocked && (
              <SecondaryButton
                color="secondary"
                disableWhenOffline
                disabled={isNavigating}
                onClick={() => goToModule(module.id)}
                sx={{
                  fontSize: theme.typography.caption.fontSize,
                  padding: `${theme.fixedSpacing(theme.tabiyaSpacing.xs)} ${theme.fixedSpacing(theme.tabiyaSpacing.md)}`,
                }}
              >
                {isNavigating ? <CircularProgress size={14} color="inherit" /> : t("careerReadiness.chat")}
              </SecondaryButton>
            )}
            {isDone && (
              <PrimaryButton
                color="secondary"
                disableWhenOffline
                disabled={isNavigating}
                onClick={() => goToModule(module.id)}
                sx={{
                  fontSize: theme.typography.caption.fontSize,
                  padding: `${theme.fixedSpacing(theme.tabiyaSpacing.xs)} ${theme.fixedSpacing(theme.tabiyaSpacing.md)}`,
                }}
              >
                {isNavigating ? <CircularProgress size={14} color="inherit" /> : t("careerReadiness.statusDone")}
              </PrimaryButton>
            )}
          </Box>
        </Box>
      )}
      {shouldShowRowDivider(moduleIndex, module.id, sorted, expandedModuleId) && (
        <Divider
          sx={{
            borderColor: `color-mix(in srgb, ${secondary.main} 35%, transparent)`,
          }}
        />
      )}
    </Box>
  );
};

export default JobReadyListRow;
