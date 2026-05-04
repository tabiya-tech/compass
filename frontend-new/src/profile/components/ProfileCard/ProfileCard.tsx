import React, { useCallback } from "react";
import { Box, Divider, Skeleton, Typography, useTheme } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import { useTranslation } from "react-i18next";
import { useExperiencesDrawer } from "src/experiences/ExperiencesDrawerProvider";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";

const uniqueId = "profile-card-a6d2e3f4-7b8c-9d1e-2f3a-4b5c6d7e8f9a";

export const DATA_TEST_ID = {
  PROFILE_CARD: `profile-card-${uniqueId}`,
  PROFILE_TITLE: `profile-title-${uniqueId}`,
  VIEW_MY_CV_BUTTON: `profile-view-my-cv-${uniqueId}`,
  SHARE_BUTTON: `profile-share-${uniqueId}`,
};

export interface ProfileCardProps {
  name: string | null;
  location: string | null;
  school: string | null;
  program: string | null;
  year: string | null;
  isLoading: boolean;
}

const profileInitials = (name: string | null): string => {
  if (!name?.trim()) {
    return "?";
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0];
    const b = parts[parts.length - 1][0];
    return `${a}${b}`.toUpperCase();
  }
  return parts[0][0].toUpperCase();
};

const buildProfileSubtitle = (year: string | null, school: string | null, location: string | null): string => {
  const parts = [year, school, location].filter((p) => p != null && String(p).trim() !== "");
  return parts.join(" · ");
};

export const ProfileCard: React.FC<ProfileCardProps> = ({ name, location, school, program, year, isLoading }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { openExperiencesDrawer } = useExperiencesDrawer();

  const avatarSize = theme.fixedSpacing(theme.tabiyaSpacing.xl * 1.75);

  const subtitle = buildProfileSubtitle(year, school, location);

  const handleViewCv = useCallback(() => {
    void openExperiencesDrawer();
  }, [openExperiencesDrawer]);

  const handleShareProfile = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = name?.trim() || t("home.profile.myProfile");
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text: title, url });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        enqueueSnackbar(t("home.profile.linkCopied"), { variant: "success" });
        return;
      }
      enqueueSnackbar(t("home.profile.shareProfileUnavailable"), { variant: "info" });
    } catch (err: unknown) {
      if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError") {
        return;
      }
      enqueueSnackbar(t("home.profile.shareProfileUnavailable"), { variant: "info" });
    }
  }, [enqueueSnackbar, name, t]);

  return (
    <Box
      data-testid={DATA_TEST_ID.PROFILE_CARD}
      sx={{
        backgroundColor: "transparent",
        border: "none",
        boxShadow: "none",
        paddingY: theme.fixedSpacing(theme.tabiyaSpacing.md),
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
          gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
            minWidth: 0,
            flex: { xs: "1 1 auto", md: "0 1 auto" },
          }}
        >
          {isLoading ? (
            <Skeleton variant="circular" sx={{ width: avatarSize, height: avatarSize, flexShrink: 0 }} />
          ) : (
            <Box
              sx={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: theme.rounding(theme.tabiyaRounding.full),
                backgroundColor: theme.palette.primary.main,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{
                  color: theme.palette.primary.contrastText,
                  fontWeight: 700,
                  lineHeight: 1,
                  fontFamily: theme.typography.body2.fontFamily,
                }}
              >
                {profileInitials(name)}
              </Typography>
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            {isLoading ? (
              <>
                <Skeleton variant="text" sx={{ width: { xs: "80%", md: 200 }, fontSize: "1.5rem" }} />
                <Skeleton variant="text" sx={{ width: { xs: "100%", md: 280 }, fontSize: "0.875rem" }} />
              </>
            ) : (
              <>
                <Typography
                  variant="h5"
                  component="h2"
                  sx={{
                    fontWeight: 700,
                    lineHeight: 1.25,
                    color: theme.palette.text.primary,
                  }}
                  data-testid={DATA_TEST_ID.PROFILE_TITLE}
                >
                  {name || t("home.profile.notAvailable")}
                </Typography>
                {subtitle ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      marginTop: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
                      lineHeight: 1.4,
                      fontFamily: theme.typography.body2.fontFamily,
                    }}
                  >
                    {subtitle}
                  </Typography>
                ) : null}
              </>
            )}
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            flexWrap: { xs: "wrap", sm: "nowrap" },
            alignItems: "stretch",
            gap: { xs: theme.fixedSpacing(theme.tabiyaSpacing.md), sm: theme.fixedSpacing(theme.tabiyaSpacing.sm) },
            width: { xs: "100%", md: "auto" },
            flex: { xs: "1 1 auto", md: "0 0 auto" },
            minWidth: 0,
          }}
        >
          {isLoading ? (
            <>
              <Skeleton
                variant="rounded"
                sx={{
                  flex: { xs: "none", sm: 1, md: "0 0 auto" },
                  width: { xs: "100%", sm: "auto", md: 150 },
                  minWidth: 0,
                  height: 48,
                  borderRadius: 999,
                }}
              />
              <Skeleton
                variant="rounded"
                sx={{
                  flex: { xs: "none", sm: 1, md: "0 0 auto" },
                  width: { xs: "100%", sm: "auto", md: 120 },
                  minWidth: 0,
                  height: 48,
                  borderRadius: 999,
                }}
              />
            </>
          ) : (
            <>
              <PrimaryButton
                color="primary"
                showCircle
                disableWhenOffline
                startIcon={<DescriptionOutlinedIcon />}
                onClick={handleViewCv}
                data-testid={DATA_TEST_ID.VIEW_MY_CV_BUTTON}
                sx={{
                  width: { xs: "100%", sm: "auto" },
                  flex: { xs: "none", sm: 1, md: "0 0 auto" },
                }}
              >
                {t("home.profile.viewMyCv")}
              </PrimaryButton>
              <SecondaryButton
                startIcon={<ShareOutlinedIcon />}
                disableWhenOffline
                onClick={() => void handleShareProfile()}
                data-testid={DATA_TEST_ID.SHARE_BUTTON}
                sx={{
                  width: { xs: "100%", sm: "auto" },
                  flex: { xs: "none", sm: 1, md: "0 0 auto" },
                }}
              >
                {t("home.profile.share")}
              </SecondaryButton>
            </>
          )}
        </Box>
      </Box>

      <Divider sx={{ marginTop: theme.fixedSpacing(theme.tabiyaSpacing.md) }} />
    </Box>
  );
};
