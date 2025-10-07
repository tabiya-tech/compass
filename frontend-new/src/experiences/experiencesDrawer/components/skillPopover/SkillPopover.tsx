import React from "react";
import { Popover, Box, Typography, useTheme } from "@mui/material";
import { Skill } from "src/experiences/experienceService/experiences.types";
import { capitalizeFirstLetter } from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import { useTranslation } from "react-i18next";

const uniqueId = "0ee9a0ec-fd74-4628-9b77-0ed10d4413ae";

export const DATA_TEST_ID = {
  SKILL_POPOVER: `skill-popover-${uniqueId}`,
  SKILL_POPOVER_LABEL: `skill-popover-label-${uniqueId}`,
  SKILL_POPOVER_DESCRIPTION: `skill-popover-description-${uniqueId}`,
  SKILL_POPOVER_ALT_LABELS_TITLE: `skill-popover-alt-labels-title-${uniqueId}`,
  SKILL_POPOVER_ALT_LABELS: `skill-popover-alt-labels-${uniqueId}`,
};

export interface SkillPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  skill: Skill | null;
}

const SkillPopover: React.FC<SkillPopoverProps> = ({ open, anchorEl, onClose, skill }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: "top",
        horizontal: "center",
      }}
      transformOrigin={{
        vertical: "bottom",
        horizontal: "center",
      }}
      onClose={onClose}
      data-testid={DATA_TEST_ID.SKILL_POPOVER}
    >
      <Box
        display="flex"
        flexDirection="column"
        gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
        maxWidth={500}
        color={theme.palette.text.secondary}
        padding={theme.fixedSpacing(theme.tabiyaSpacing.md)}
      >
        <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}>
          <Typography variant="caption" fontWeight="bold" data-testid={DATA_TEST_ID.SKILL_POPOVER_LABEL}>
            {capitalizeFirstLetter(skill?.preferredLabel ?? "")}
          </Typography>
          <Typography variant="caption" data-testid={DATA_TEST_ID.SKILL_POPOVER_DESCRIPTION}>
            {skill?.description}
          </Typography>
        </Box>
        <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}>
          <Typography variant="caption" fontWeight="bold" data-testid={DATA_TEST_ID.SKILL_POPOVER_ALT_LABELS_TITLE}>
            {t("experiences.experiencesDrawer.components.skillPopover.alsoKnownAs")}
          </Typography>
          <Typography
            variant="caption"
            sx={{ wordBreak: "break-word" }}
            data-testid={DATA_TEST_ID.SKILL_POPOVER_ALT_LABELS}
          >
            {skill?.altLabels.map((label) => capitalizeFirstLetter(label)).join(", ")}
          </Typography>
        </Box>
      </Box>
    </Popover>
  );
};

export default SkillPopover;
