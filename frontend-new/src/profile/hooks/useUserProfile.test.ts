import "src/_test_utilities/consoleMock";
import "src/_test_utilities/envServiceMock";

import { renderHook, waitFor } from "src/_test_utilities/test-utils";
import { useUserProfile } from "./useUserProfile";
import UserMeService from "src/userMe/UserMeService";
import type { ModuleSummary } from "src/careerReadiness/types";

// Mock all external dependencies
jest.mock("src/userMe/UserMeService");
jest.mock("src/auth/services/AuthenticationState.service", () => ({
  __esModule: true,
  default: { getInstance: jest.fn(() => ({ getUser: jest.fn(() => ({ id: "user-1", email: "test@test.com" })) })) },
}));
jest.mock("src/userPreferences/UserPreferencesStateService", () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({
      getUserPreferences: jest.fn(() => ({ accepted_tc: null, language: "en" })),
      getActiveSessionId: jest.fn(() => null),
    })),
  },
}));
jest.mock("./utils/fetchSkills", () => ({
  fetchSkills: jest.fn(() =>
    Promise.resolve({ workSkills: [], educationSkills: [], totalExperiences: 0, exploredExperiences: 0 })
  ),
}));

const mockModules: ModuleSummary[] = [
  {
    id: "m1",
    title: "Module 1",
    description: "",
    icon: "",
    status: "COMPLETED",
    sort_order: 1,
    input_placeholder: "",
    active_conversation_id: null,
    topics: [],
  },
  {
    id: "m2",
    title: "Module 2",
    description: "",
    icon: "",
    status: "IN_PROGRESS",
    sort_order: 2,
    input_placeholder: "",
    active_conversation_id: "conv-123",
    topics: [],
  },
];

const mockProfileResponse = {
  personal_data: null,
  programme_skills: [],
};

const mockProgressResponse = {
  skills_interests_progress: 0,
  career_readiness_modules: mockModules,
  sector_engagement: [],
};

describe("useUserProfile", () => {
  let mockGetProfile: jest.Mock;
  let mockGetProgress: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProfile = jest.fn(() => Promise.resolve(mockProfileResponse));
    mockGetProgress = jest.fn(() => Promise.resolve(mockProgressResponse));

    (UserMeService.getInstance as jest.Mock).mockReturnValue({
      getProfile: mockGetProfile,
      getProgress: mockGetProgress,
    });
  });

  test("should fetch and return module statuses from UserMeService.getProgress", async () => {
    // WHEN the hook is rendered
    const { result } = renderHook(() => useUserProfile());

    // THEN eventually modules are populated from the API
    await waitFor(() => {
      expect(result.current.isLoadingModules).toBe(false);
    });

    expect(result.current.profileData.modules).toEqual(mockModules);
  });

  test("should set modules error when progress API call fails", async () => {
    // GIVEN the service throws
    (UserMeService.getInstance as jest.Mock).mockReturnValue({
      getProfile: jest.fn(() => Promise.resolve(mockProfileResponse)),
      getProgress: jest.fn(() => Promise.reject(new Error("Network error"))),
    });

    // WHEN the hook is rendered
    const { result } = renderHook(() => useUserProfile());

    // THEN modules error is set and modules remain empty
    await waitFor(() => {
      expect(result.current.isLoadingModules).toBe(false);
    });

    expect(result.current.errors.modules).toBeInstanceOf(Error);
    expect(result.current.profileData.modules).toEqual([]);
  });

  test("should populate personal data from UserMeService.getProfile", async () => {
    // GIVEN the profile endpoint returns data
    (UserMeService.getInstance as jest.Mock).mockReturnValue({
      getProfile: jest.fn(() =>
        Promise.resolve({
          personal_data: {
            first_name: "Bupe",
            last_name: "Phiri",
            province: "Lusaka",
            institution_name: "UNZA",
            programme_name: "ICT",
            school_year: "Year 2",
          },
          programme_skills: ["JavaScript", "Python"],
        })
      ),
      getProgress: jest.fn(() => Promise.resolve(mockProgressResponse)),
    });

    const { result } = renderHook(() => useUserProfile());

    await waitFor(() => {
      expect(result.current.isLoadingProfile).toBe(false);
    });

    expect(result.current.profileData.name).toBe("Bupe Phiri");
    expect(result.current.profileData.location).toBe("Lusaka");
    expect(result.current.profileData.school).toBe("UNZA");
    expect(result.current.profileData.programmeSkills).toEqual(["JavaScript", "Python"]);
  });
});
