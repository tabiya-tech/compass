import React, { startTransition, useContext, useState } from "react";
import { alpha } from "@mui/material/styles";
import { Box, CircularProgress, Grid, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { routerPaths } from "src/app/routerPaths";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";

const uniqueId = "b2c3d4e5-f6a7-8901-bcde-f23456789012";

export const DATA_TEST_ID = {
  HOME_CTA_GRID: `home-cta-grid-${uniqueId}`,
  HOME_CTA_CARD: `home-cta-card-${uniqueId}`,
};

const splitTitle = (title: string): { lead: string; tail: string } => {
  const [lead, ...rest] = title.trim().split(" ");
  return { lead: lead ?? "", tail: rest.join(" ") };
};

const CtaTitle: React.FC<{ title: string; leadColor: string; tailColor: string }> = ({
  title,
  leadColor,
  tailColor,
}) => {
  const { lead, tail } = splitTitle(title);
  return (
    <Typography variant="h3" sx={{ color: leadColor, marginBottom: 1 }}>
      <Box component="span" sx={{ display: "block" }}>
        {lead}
      </Box>
      {tail && (
        <Box component="span" sx={{ display: "block", color: tailColor }}>
          {tail}
        </Box>
      )}
    </Typography>
  );
};

interface CtaCardProps {
  testKey: "profile" | "paths" | "jobs";
  edge?: "start" | "middle" | "end";
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
  isLoading?: boolean;
  backgroundColor: string;
  titleLeadColor: string;
  titleTailColor: string;
  descriptionColor: string;
  filledButton?: {
    color: "primary" | "secondary";
    bgColor: string;
    textColor: string;
  };
  outlinedButton?: {
    color: "primary" | "secondary" | "tertiary";
  };
}

const HomeCtaCard: React.FC<CtaCardProps> = ({
  testKey,
  title,
  description,
  cta,
  onClick,
  isLoading = false,
  backgroundColor,
  titleLeadColor,
  titleTailColor,
  descriptionColor,
  filledButton,
  outlinedButton,
}) => {
  const theme = useTheme();
  const contentPadding = theme.fixedSpacing(theme.tabiyaSpacing.lg);

  return (
    <Grid size={{ xs: 12, md: 4 }}>
      <Box
        data-testid={`${DATA_TEST_ID.HOME_CTA_CARD}-${testKey}`}
        sx={{
          backgroundColor,
          borderRadius: 0,
          paddingTop: contentPadding,
          paddingBottom: contentPadding,
          paddingX: "var(--layout-gutter-x)",
          minHeight: { xs: "auto", sm: 240 },
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          height: "100%",
        }}
      >
        <CtaTitle title={title} leadColor={titleLeadColor} tailColor={titleTailColor} />
        <Typography
          variant="body2"
          sx={{
            color: descriptionColor,
            marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.md),
            flex: 1,
            lineHeight: 1.5,
          }}
        >
          {description}
        </Typography>

        {filledButton ? (
          <PrimaryButton
            color={filledButton.color}
            variant="contained"
            showCircle
            disableWhenOffline
            disabled={isLoading}
            onClick={onClick}
            sx={{
              alignSelf: "flex-start",
              bgcolor: filledButton.bgColor,
              color: filledButton.textColor,
            }}
          >
            {isLoading ? <CircularProgress size={16} color="inherit" /> : cta}
          </PrimaryButton>
        ) : (
          <SecondaryButton
            color={outlinedButton?.color}
            showCircle
            disableWhenOffline
            disabled={isLoading}
            onClick={onClick}
          >
            {isLoading ? <CircularProgress size={16} color="inherit" /> : cta}
          </SecondaryButton>
        )}
      </Box>
    </Grid>
  );
};

const HomeCtaGrid: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isOnline = useContext(IsOnlineContext);
  const [loadingCta, setLoadingCta] = useState<CtaCardProps["testKey"] | null>(null);

  const go = (path: string) => {
    if (!isOnline) return;
    if (loadingCta !== null) return;
    startTransition(() => {
      navigate(path);
    });
  };

  const profileCardBg = theme.palette.secondary.main;
  const profileCardText = theme.palette.common.white;
  const pathwaysCardBg = theme.palette.primary.main;

  return (
    <Box sx={{ display: "flex", width: "100%" }}>
      {/* Left Spacer - Extends the first card background to the left edge */}
      <Box
        sx={{
          flex: 1,
          backgroundColor: profileCardBg,
          display: { xs: "none", md: "block" },
        }}
      />

      {/* Main Content Area - Centered and limited by max-width */}
      <Box
        sx={{
          width: "100%",
          maxWidth: "var(--layout-content-max-width)",
          mx: "auto",
        }}
      >
        <Grid container spacing={0} data-testid={DATA_TEST_ID.HOME_CTA_GRID}>
          <HomeCtaCard
            testKey="profile"
            title={t("home.cta.buildProfileTitle")}
            description={t("home.cta.buildProfileDesc")}
            cta={t("home.cta.buildProfileCta")}
            onClick={() => {
              setLoadingCta("profile");
              go(routerPaths.SKILLS_INTERESTS);
            }}
            isLoading={loadingCta === "profile"}
            backgroundColor={profileCardBg}
            titleLeadColor={profileCardText}
            titleTailColor={alpha(profileCardText, 0.8)}
            descriptionColor={profileCardText}
            filledButton={{
              color: "secondary",
              bgColor: theme.palette.tertiary.light,
              textColor: profileCardBg,
            }}
          />

          <HomeCtaCard
            testKey="paths"
            title={t("home.cta.explorePathsTitle")}
            description={t("home.cta.explorePathsDesc")}
            cta={t("home.cta.explorePathsCta")}
            onClick={() => {
              setLoadingCta("paths");
              go(routerPaths.CAREER_EXPLORER);
            }}
            isLoading={loadingCta === "paths"}
            backgroundColor={pathwaysCardBg}
            titleLeadColor={theme.palette.common.white}
            titleTailColor={alpha(theme.palette.common.white, 0.8)}
            descriptionColor={theme.palette.common.white}
            filledButton={{
              color: "primary",
              bgColor: theme.palette.tertiary.light,
              textColor: pathwaysCardBg,
            }}
          />

          <HomeCtaCard
            testKey="jobs"
            title={t("home.cta.jobMatchesTitle")}
            description={t("home.cta.jobMatchesDesc")}
            cta={t("home.cta.jobMatchesCta")}
            onClick={() => {
              setLoadingCta("jobs");
              go(routerPaths.JOB_MATCHING);
            }}
            isLoading={loadingCta === "jobs"}
            backgroundColor={theme.palette.tertiary.light}
            titleLeadColor={theme.palette.tertiary.main}
            titleTailColor={theme.palette.tertiary.main}
            descriptionColor={theme.palette.text.primary}
            outlinedButton={{
              color: "tertiary",
            }}
          />
        </Grid>
      </Box>

      {/* Right Spacer - Extends last card background to the right edge */}
      <Box
        sx={{
          flex: 1,
          backgroundColor: theme.palette.tertiary.light,
          display: { xs: "none", md: "block" },
        }}
      />
    </Box>
  );
};

export default HomeCtaGrid;
