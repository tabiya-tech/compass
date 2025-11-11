import React, { useState } from "react";
import { Theme, useTheme } from "@mui/material/styles";
import { Box, Chip, Divider, Slide, Typography, useMediaQuery } from "@mui/material";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import InfoIcon from "@mui/icons-material/Info";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";
import { Skill } from "src/experiences/experienceService/experiences.types";
import { capitalizeFirstLetter } from "src/experiences/experiencesDrawer/components/experiencesDrawerContent/ExperiencesDrawerContent";
import SkillPopover from "src/experiences/experiencesDrawer/components/skillPopover/SkillPopover";
import HelpTip from "src/theme/HelpTip/HelpTip";
import { deduplicateSkills } from "src/utils/skillsUtils";
import { useTranslation } from "react-i18next";

const uniqueId = "82681361-b582-4dc3-8129-63f3f0f66eee";

export const DATA_TEST_ID = {
  SKILLS_DRAWER: `skills-drawer-${uniqueId}`,
  SKILL_DRAWER_TITLE: `skills-drawer-title-${uniqueId}`,
  SKILL_DRAWER_SUBTITLE: `skills-drawer-subtitle-${uniqueId}`,
  SKILL_DRAWER_ITEM: `skills-drawer-item-${uniqueId}`,
  SKILL_DRAWER_ITEM_CHECKED: `skills-drawer-item-checked-${uniqueId}`,
  SKILL_DRAWER_ITEM_UNCHECKED: `skills-drawer-item-unchecked-${uniqueId}`,
  SKILL_DRAWER_CANCEL_BUTTON: `skills-drawer-cancel-button-${uniqueId}`,
  SKILL_DRAWER_OK_BUTTON: `skills-drawer-ok-button-${uniqueId}`,
  SKILL_DRAWER_HELP_TIP: `skills-drawer-help-tip-${uniqueId}`,
  SKILL_DRAWER_DUPLICATE_WARNING: `skills-drawer-duplicate-warning-${uniqueId}`,
};

interface AddSkillsDrawerProps {
  onClose: () => void;
  skills: Skill[];
  onAddSkill: (skillIds: string[]) => void;
}

const AddSkillsDrawer: React.FC<AddSkillsDrawerProps> = ({ onClose, skills, onAddSkill }) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const { t } = useTranslation();
  const [selectedSkillIds, setSelectedSkillIds] = React.useState<string[]>([]);
  const [popoverAnchorEl, setPopoverAnchorEl] = React.useState<HTMLElement | null>(null);
  const [popoverSkill, setPopoverSkill] = useState<Skill | null>(null);
  const drawerRef = React.useRef<HTMLDivElement>(null);

  // Deduplicate skills and check for duplicates
  const { uniqueSkills } = deduplicateSkills(skills);

  // Scroll to top when drawer opens
  React.useEffect(() => {
    if (drawerRef.current) {
      drawerRef.current.scrollTop = 0;
    }
  }, [skills.length]);

  const handleSkillToggle = (skillId: string) => {
    setSelectedSkillIds((prev) => (prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]));
  };

  const handleOk = () => {
    if (selectedSkillIds.length > 0) {
      onAddSkill(selectedSkillIds);
      setSelectedSkillIds([]);
    }
  };

  const handleCancel = () => {
    setSelectedSkillIds([]);
    onClose();
  };

  const handleSkillLabelClick = (event: React.MouseEvent<HTMLElement>, skill: Skill) => {
    setPopoverAnchorEl(event.currentTarget);
    setPopoverSkill(skill);
  };

  return (
    <Slide direction="left" in={true} appear={true}>
      <Box
        ref={drawerRef}
        display="flex"
        flexDirection="column"
        height="100vh"
        overflow="hidden"
        data-testid={DATA_TEST_ID.SKILLS_DRAWER}
      >
        <Box
          display="flex"
          flexDirection="column"
          gap={theme.fixedSpacing(theme.tabiyaSpacing.lg)}
          padding={isSmallMobile ? theme.fixedSpacing(theme.tabiyaSpacing.md) : theme.tabiyaSpacing.lg}
          sx={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            "&::-webkit-scrollbar": {
              width: theme.fixedSpacing(theme.tabiyaSpacing.sm),
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: theme.palette.primary.dark,
              borderRadius: theme.fixedSpacing(theme.tabiyaSpacing.xs),
            },
          }}
        >
          <Box display="flex" flexDirection="column" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
            <Box display="flex" alignItems="center" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
              <Typography variant="h5" data-testid={DATA_TEST_ID.SKILL_DRAWER_TITLE}>
                Select Skills
              </Typography>
              <HelpTip icon={<InfoIcon />} data-testid={DATA_TEST_ID.SKILL_DRAWER_HELP_TIP}>
                Tap a skill to view more details. You can select the skills you want to add to your experience.
              </HelpTip>
            </Box>
            <Typography variant="body2" fontWeight="bold" data-testid={DATA_TEST_ID.SKILL_DRAWER_SUBTITLE}>
              These are additional top skills identified by Compass based on your experience.
            </Typography>
          </Box>
          <Box display="flex" flexWrap="wrap" whiteSpace="normal" gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
            {uniqueSkills.map((skill) => (
              <Chip
                key={skill.UUID}
                onClick={(event) => handleSkillLabelClick(event, skill)}
                label={
                  <Box display="flex" alignItems="center" gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
                    <Box
                      display="flex"
                      alignItems="center"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSkillToggle(skill.UUID);
                      }}
                    >
                      {selectedSkillIds.includes(skill.UUID) ? (
                        <CheckBoxIcon
                          sx={{ color: theme.palette.primary.dark }}
                          data-testid={DATA_TEST_ID.SKILL_DRAWER_ITEM_CHECKED}
                        />
                      ) : (
                        <CheckBoxOutlineBlankIcon
                          sx={{ color: theme.palette.text.secondary }}
                          data-testid={DATA_TEST_ID.SKILL_DRAWER_ITEM_UNCHECKED}
                        />
                      )}
                    </Box>
                    <Typography overflow="hidden" textOverflow="ellipsis">
                      {capitalizeFirstLetter(skill.preferredLabel)}
                    </Typography>
                  </Box>
                }
                sx={{
                  color: theme.palette.text.secondary,
                  backgroundColor: theme.palette.grey[100],
                }}
                data-testid={DATA_TEST_ID.SKILL_DRAWER_ITEM}
              />
            ))}
          </Box>
        </Box>
        <Box
          display="flex"
          flexDirection="column"
          position="sticky"
          bottom={0}
          bgcolor={theme.palette.background.paper}
          paddingX={isSmallMobile ? theme.fixedSpacing(theme.tabiyaSpacing.md) : theme.tabiyaSpacing.lg}
        >
          <Divider color="primary" sx={{ height: "0.2rem" }} />
          <Box
            display="flex"
            justifyContent="flex-end"
            gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
            paddingY={theme.fixedSpacing(theme.tabiyaSpacing.md)}
          >
            <SecondaryButton onClick={handleCancel} data-testid={DATA_TEST_ID.SKILL_DRAWER_CANCEL_BUTTON}>
              {t("common.buttons.cancel")}
            </SecondaryButton>
            <PrimaryButton
              onClick={handleOk}
              disableWhenOffline
              disabled={selectedSkillIds.length === 0}
              data-testid={DATA_TEST_ID.SKILL_DRAWER_OK_BUTTON}
            >
              OK
            </PrimaryButton>
          </Box>
        </Box>
        <SkillPopover
          open={Boolean(popoverAnchorEl)}
          anchorEl={popoverAnchorEl}
          onClose={() => setPopoverAnchorEl(null)}
          skill={popoverSkill}
        />
      </Box>
    </Slide>
  );
};

export default AddSkillsDrawer;
