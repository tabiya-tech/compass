import React, { useMemo } from "react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import Sidebar from "src/theme/Sidebar/Sidebar";
import { useWorkSkills } from "src/experiences/hooks/useWorkSkills";
import { useExperiencesDrawer } from "src/experiences/ExperiencesDrawerProvider";
import { useUserProfileContext } from "src/profile/UserProfileContext";
import SectionTitle from "src/home/components/Sidebar/SectionTitle";
import ChipList from "src/home/components/Sidebar/ChipList";
import ViewCVCard from "src/home/components/Sidebar/ViewCVCard";

const uniqueId = "e4f5a6b7-c8d9-0123-efab-456789012345";

export const DATA_TEST_ID = {
  HOME_SIDEBAR_SKILLS_FROM_WORK_CHIP: `home-sidebar-skills-from-work-chip-${uniqueId}`,
  HOME_SIDEBAR_SKILLS_FROM_WORK_EMPTY: `home-sidebar-skills-from-work-empty-${uniqueId}`,
  HOME_SIDEBAR_SKILLS_FROM_WORK_EXPAND_BUTTON: `home-sidebar-skills-from-work-expand-button-${uniqueId}`,
  HOME_SIDEBAR_PROGRAMME_SKILLS_CHIP: `home-sidebar-programme-skills-chip-${uniqueId}`,
  HOME_SIDEBAR_PROGRAMME_SKILLS_EMPTY: `home-sidebar-programme-skills-empty-${uniqueId}`,
  HOME_SIDEBAR_PROGRAMME_SKILLS_EXPAND_BUTTON: `home-sidebar-programme-skills-expand-button-${uniqueId}`,
};

interface HomeSidebarProps {
  showViewCvButton?: boolean;
}

const HomeSidebar: React.FC<HomeSidebarProps> = ({ showViewCvButton = true }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { openExperiencesDrawer } = useExperiencesDrawer();
  const drawerWorkSkills = useWorkSkills();
  const { profileData } = useUserProfileContext();
  const programmeSkills = profileData.programmeSkills;
  const workSkills = useMemo(() => {
    const labels = profileData.skills.map((skill) => skill.preferredLabel).filter(Boolean);
    const uniqueProfileSkills = Array.from(new Set(labels));
    return drawerWorkSkills.length > 0 ? drawerWorkSkills : uniqueProfileSkills;
  }, [profileData.skills, drawerWorkSkills]);

  const accentColor = theme.palette.primary.main;
  const tealBg = theme.palette.brandAccent.light;
  const amberBg = theme.palette.common.cream;

  const handleViewCV = () => void openExperiencesDrawer();

  return (
    <Sidebar width="100%" disablePadding>
      <Box>
        <SectionTitle>{t("home.sidebar.home.skillsFromWork")}</SectionTitle>
        <ChipList
          chips={workSkills}
          chipBgColor={tealBg}
          chipTextColor={accentColor}
          accentColor={accentColor}
          emptyText={t("home.sidebar.home.workSkillsEmpty")}
          emptyTestId={DATA_TEST_ID.HOME_SIDEBAR_SKILLS_FROM_WORK_EMPTY}
          chipTestId={DATA_TEST_ID.HOME_SIDEBAR_SKILLS_FROM_WORK_CHIP}
          expandButtonTestId={DATA_TEST_ID.HOME_SIDEBAR_SKILLS_FROM_WORK_EXPAND_BUTTON}
        />
      </Box>
      <Box>
        <SectionTitle>{t("home.sidebar.home.skillsFromTEVET")}</SectionTitle>
        <ChipList
          chips={programmeSkills}
          chipBgColor={amberBg}
          chipTextColor={theme.palette.common.black}
          accentColor={accentColor}
          emptyText={t("home.sidebar.home.programmeSkillsEmpty")}
          emptyTestId={DATA_TEST_ID.HOME_SIDEBAR_PROGRAMME_SKILLS_EMPTY}
          chipTestId={DATA_TEST_ID.HOME_SIDEBAR_PROGRAMME_SKILLS_CHIP}
          expandButtonTestId={DATA_TEST_ID.HOME_SIDEBAR_PROGRAMME_SKILLS_EXPAND_BUTTON}
        />
      </Box>
      {showViewCvButton && (
        <Box>
          <SectionTitle>{t("home.sidebar.home.myExperience")}</SectionTitle>
          <ViewCVCard onClick={handleViewCV} />
        </Box>
      )}
    </Sidebar>
  );
};

export default HomeSidebar;
