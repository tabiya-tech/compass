import React, { startTransition } from "react";
import { alpha } from "@mui/material/styles";
import { Box, Grid, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
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
  backgroundColor: string;
  titleLeadColor: string;
  titleTailColor: string;
  descriptionColor: string;
  filledButton?: {
    color: "primary" | "brandAction";
    bgColor: string;
    textColor: string;
  };
  outlinedButton?: {
    color: "brandAction" | "secondary";
  };
}

const HomeCtaCard: React.FC<CtaCardProps> = ({
  testKey,
  edge = "middle",
  title,
  description,
  cta,
  onClick,
  backgroundColor,
  titleLeadColor,
  titleTailColor,
  descriptionColor,
  filledButton,
  outlinedButton,
}) => {
  const theme = useTheme();
  const contentPadding = theme.fixedSpacing(theme.tabiyaSpacing.lg);
  const alignedEdgeInset =
    "min(calc(max((100vw - var(--layout-content-max-width)) / 2, 0px) + var(--layout-gutter-x)), calc(100% - 320px))";

  return (
    <Grid size={{ xs: 12, md: 4 }}>
      <Box
        data-testid={`${DATA_TEST_ID.HOME_CTA_CARD}-${testKey}`}
        sx={{
          backgroundColor,
          borderRadius: 0,
          paddingTop: contentPadding,
          paddingBottom: contentPadding,
          paddingLeft: {
            xs: "var(--layout-gutter-x)",
            sm: contentPadding,
            md: edge === "start" ? alignedEdgeInset : contentPadding,
          },
          paddingRight: {
            xs: "var(--layout-gutter-x)",
            sm: contentPadding,
            md: edge === "end" ? alignedEdgeInset : contentPadding,
          },
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
            onClick={onClick}
            sx={{
              alignSelf: "flex-start",
              bgcolor: filledButton.bgColor,
              color: filledButton.textColor,
            }}
          >
            {cta}
          </PrimaryButton>
        ) : (
          <SecondaryButton color={outlinedButton?.color} showCircle onClick={onClick}>
            {cta}
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

  const go = (path: string) => {
    startTransition(() => {
      navigate(path);
    });
  };

  const profileCardBg = theme.palette.primary.main;
  const profileCardText = theme.palette.common.white;
  const pathwaysCardBg = theme.palette.brandAction.main;

  return (
    <Grid
      container
      spacing={0}
      data-testid={DATA_TEST_ID.HOME_CTA_GRID}
      sx={{
        position: "relative",
        zIndex: 0,
        width: { xs: "100%", md: "100vw" },
        marginLeft: { xs: 0, md: "calc(50% - 50vw)" },
        marginRight: { xs: 0, md: "calc(50% - 50vw)" },
      }}
    >
      <HomeCtaCard
        testKey="profile"
        edge="start"
        title={t("home.cta.buildProfileTitle")}
        description={t("home.cta.buildProfileDesc")}
        cta={t("home.cta.buildProfileCta")}
        onClick={() => go(routerPaths.SKILLS_INTERESTS)}
        backgroundColor={profileCardBg}
        titleLeadColor={profileCardText}
        titleTailColor={alpha(profileCardText, 0.8)}
        descriptionColor={profileCardText}
        filledButton={{
          color: "primary",
          bgColor: theme.palette.common.cream,
          textColor: profileCardBg,
        }}
      />

      <HomeCtaCard
        testKey="paths"
        edge="middle"
        title={t("home.cta.explorePathsTitle")}
        description={t("home.cta.explorePathsDesc")}
        cta={t("home.cta.explorePathsCta")}
        onClick={() => go(routerPaths.CAREER_EXPLORER)}
        backgroundColor={pathwaysCardBg}
        titleLeadColor={theme.palette.common.white}
        titleTailColor={alpha(theme.palette.common.white, 0.8)}
        descriptionColor={theme.palette.common.white}
        filledButton={{
          color: "brandAction",
          bgColor: theme.palette.common.cream,
          textColor: pathwaysCardBg,
        }}
      />

      <HomeCtaCard
        testKey="jobs"
        edge="end"
        title={t("home.cta.jobMatchesTitle")}
        description={t("home.cta.jobMatchesDesc")}
        cta={t("home.cta.jobMatchesCta")}
        onClick={() => go(routerPaths.JOB_MATCHING)}
        backgroundColor={theme.palette.common.cream}
        titleLeadColor={theme.palette.secondary.main}
        titleTailColor={theme.palette.secondary.main}
        descriptionColor={theme.palette.text.primary}
        outlinedButton={{
          color: "secondary",
        }}
      />
    </Grid>
  );
};

export default HomeCtaGrid;
