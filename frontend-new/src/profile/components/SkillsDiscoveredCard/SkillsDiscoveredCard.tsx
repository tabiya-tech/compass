import React from "react";
import { Box, Typography, Skeleton, Chip, useTheme, Divider } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Skill } from "src/experiences/experienceService/experiences.types";

const uniqueId = "skills-discovered-card-c8f4a5b6-9d1e-2f3a-4b5c-6d7e8f9a1b2c";

export const DATA_TEST_ID = {
  SKILLS_CARD: `skills-card-${uniqueId}`,
  SKILLS_TITLE: `skills-title-${uniqueId}`,
  SKILLS_EMPTY: `skills-empty-${uniqueId}`,
  SKILL_ITEM: (index: number) => `skill-item-${index}-${uniqueId}`,
};

export interface SkillsDiscoveredCardProps {
  skills: Skill[];
  educationSkills: Skill[];
  school?: string | null;
  program?: string | null;
  isLoading: boolean;
}

const VISIBLE_LIMIT = 5;

const SkillSection: React.FC<{
  title: string;
  subtitle?: string | null;
  skills: Skill[];
  emptyText: string;
  isLoading: boolean;
  startIndex?: number;
  titleTestId?: string;
  emptyTestId?: string;
  chipBgColor: string;
  chipTextColor: string;
}> = ({
  title,
  subtitle,
  skills,
  emptyText,
  isLoading,
  startIndex = 0,
  titleTestId,
  emptyTestId,
  chipBgColor,
  chipTextColor,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(false);

  const visibleSkills = isExpanded ? skills : skills.slice(0, VISIBLE_LIMIT);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: theme.fixedSpacing(theme.tabiyaSpacing.sm) }}>
      <Box>
        <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" data-testid={titleTestId}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.disabled" sx={{ mb: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {isLoading ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: theme.fixedSpacing(theme.tabiyaSpacing.xs) }}>
          {[100, 80, 120, 90, 110].map((w, i) => (
            <Skeleton key={i} variant="rectangular" width={w} height={28} sx={{ borderRadius: 999 }} />
          ))}
        </Box>
      ) : skills.length === 0 ? (
        <Typography variant="body2" color="text.secondary" data-testid={emptyTestId} sx={{ mt: 1 }}>
          {emptyText}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: theme.fixedSpacing(theme.tabiyaSpacing.xs) }}>
          {visibleSkills.map((skill, index) => (
            <Chip
              key={skill.UUID}
              label={skill.preferredLabel}
              size="small"
              data-testid={DATA_TEST_ID.SKILL_ITEM(startIndex + index)}
              sx={{
                borderRadius: theme.rounding(theme.tabiyaRounding.lg),
                backgroundColor: chipBgColor,
                color: chipTextColor,
                fontWeight: 400,
                border: "none",
                "& .MuiChip-label": {
                  padding: `${theme.fixedSpacing(theme.tabiyaSpacing.xs * 1.25)} ${theme.fixedSpacing(theme.tabiyaSpacing.sm * 1.5)}`,
                  lineHeight: 1.4,
                },
              }}
            />
          ))}
        </Box>
      )}
      {!isLoading && skills.length > VISIBLE_LIMIT && (
        <Typography
          variant="body2"
          color="primary.main"
          onClick={() => setIsExpanded(!isExpanded)}
          sx={{
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            alignSelf: "flex-start",
            mt: 0.5,
          }}
        >
          {isExpanded ? t("home.profile.skillsShowLess") : t("home.profile.skillsShowAll", { count: skills.length })}
        </Typography>
      )}
    </Box>
  );
};

export const SkillsDiscoveredCard: React.FC<SkillsDiscoveredCardProps> = ({
  skills,
  educationSkills,
  school,
  program,
  isLoading,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const educationSubtitle = [program, school].filter(Boolean).join(" \u00B7 ");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: theme.fixedSpacing(theme.tabiyaSpacing.sm) }}>
      <Typography
        variant="h4"
        data-testid={DATA_TEST_ID.SKILLS_TITLE}
        sx={{
          color: theme.palette.text.primary,
          fontWeight: 700,
        }}
      >
        {t("home.profile.skillsDiscovered")}
      </Typography>

      <Box
        sx={{
          borderRadius: theme.rounding(theme.tabiyaRounding.md),
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          padding: theme.fixedSpacing(theme.tabiyaSpacing.lg),
          display: "flex",
          flexDirection: "column",
        }}
        data-testid={DATA_TEST_ID.SKILLS_CARD}
      >
        <SkillSection
          title={t("home.profile.educationSkills")}
          subtitle={educationSubtitle}
          skills={educationSkills}
          emptyText={t("home.profile.noEducationSkillsYet")}
          isLoading={isLoading}
          startIndex={0}
          chipBgColor={theme.palette.tertiary.light}
          chipTextColor={theme.palette.common.black}
        />

        <Divider sx={{ my: theme.fixedSpacing(theme.tabiyaSpacing.md) }} />

        <SkillSection
          title={t("home.profile.workSkills")}
          skills={skills}
          emptyText={t("home.profile.noSkillsYet")}
          isLoading={isLoading}
          startIndex={educationSkills.length}
          chipBgColor={theme.palette.accent.light}
          chipTextColor={theme.palette.secondary.main}
          emptyTestId={DATA_TEST_ID.SKILLS_EMPTY}
        />
      </Box>
    </Box>
  );
};
