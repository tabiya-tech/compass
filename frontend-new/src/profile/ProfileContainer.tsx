import React from "react";
import { Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { Profile } from "./Profile";
import { useUserProfile } from "./hooks/useUserProfile";
import BackButton from "src/knowledgeHub/components/BackButton";
import { routerPaths } from "src/app/routerPaths";

const uniqueId = "b3c5d7e9-4f6a-8b2c-1d3e-5f7a9b1c3d5e";

export const DATA_TEST_ID = {
  PROFILE_CONTAINER: `profile-container-${uniqueId}`,
};

const ProfileContainer: React.FC = () => {
  const navigate = useNavigate();
  const {
    profileData,
    isLoadingSecurity,
    isLoadingPreferences,
    isLoadingProfile,
    isLoadingSkills,
    isLoadingCareerExplorer,
  } = useUserProfile();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: (theme) => theme.palette.background.default,
      }}
      data-testid={DATA_TEST_ID.PROFILE_CONTAINER}
    >
      <Box sx={{ px: "var(--layout-gutter-x)", pt: 2, pb: 1 }}>
        <BackButton onClick={() => navigate(routerPaths.ROOT)} labelKey="home.backToDashboard" />
      </Box>
      <Profile
        email={profileData.email}
        language={profileData.language}
        termsAcceptedDate={profileData.termsAcceptedDate}
        name={profileData.name}
        location={profileData.location}
        school={profileData.school}
        program={profileData.program}
        year={profileData.year}
        skills={profileData.skills}
        educationSkills={profileData.educationSkills}
        modules={profileData.modules}
        skillsInterestsProgress={profileData.skillsInterestsProgress}
        careerExplorerSectors={profileData.careerExplorerSectors}
        isLoadingSecurity={isLoadingSecurity}
        isLoadingPreferences={isLoadingPreferences}
        isLoadingProfile={isLoadingProfile}
        isLoadingSkills={isLoadingSkills}
        isLoadingCareerExplorer={isLoadingCareerExplorer}
      />
    </Box>
  );
};

export default ProfileContainer;
