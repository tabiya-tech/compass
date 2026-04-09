import React from "react";
import { Box } from "@mui/material";
import { Profile } from "./Profile";
import { useUserProfile } from "./hooks/useUserProfile";

const uniqueId = "b3c5d7e9-4f6a-8b2c-1d3e-5f7a9b1c3d5e";

export const DATA_TEST_ID = {
  PROFILE_CONTAINER: `profile-container-${uniqueId}`,
};

const ProfileContainer: React.FC = () => {
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
