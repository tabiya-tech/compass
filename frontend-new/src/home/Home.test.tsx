import "src/_test_utilities/consoleMock";
import "src/_test_utilities/envServiceMock";
import "src/_test_utilities/sentryMock";

import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import Home, { DATA_TEST_ID } from "./Home";
import { DATA_TEST_ID as FOOTER_DATA_TEST_ID } from "src/home/components/Footer/Footer";
import { DATA_TEST_ID as HERO_DATA_TEST_ID } from "src/home/components/HomeHero/HomeHero";
import { DATA_TEST_ID as CTA_DATA_TEST_ID } from "src/home/components/HomeCtaGrid/HomeCtaGrid";
import { DATA_TEST_ID as JOB_READY_DATA_TEST_ID } from "src/home/components/HomeJobReadyList/HomeJobReadyList";

jest.mock("src/experiences/ExperiencesDrawerProvider", () => ({
  useExperiencesDrawer: () => ({
    openExperiencesDrawer: jest.fn(),
    closeExperiencesDrawer: jest.fn(),
    experiences: [],
  }),
}));

const mockProfileData = {
  name: "Test User",
  modules: [] as { id: string; title: string; description: string; icon: string; status: string; sort_order: number }[],
  skills: [] as {
    UUID: string;
    preferredLabel: string;
    description: string;
    altLabels: string[];
    orderIndex: number;
  }[],
  programmeSkills: [] as string[],
};

jest.mock("src/profile/UserProfileContext", () => ({
  useUserProfileContext: () => ({
    profileData: mockProfileData,
    isLoadingModules: false,
    isLoadingSkills: false,
    errors: { modules: null },
  }),
  UserProfileProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("Home", () => {
  beforeEach(() => {
    mockProfileData.name = "Test User";
    mockProfileData.modules = [];
    mockProfileData.skills = [];
  });

  describe("render", () => {
    test("should render dashboard layout with hero, CTA grid, job-ready section, and footer", () => {
      // GIVEN default mocked profile data
      // WHEN the Home page is rendered
      render(<Home />);

      // THEN the main home layout containers are present
      expect(screen.getByTestId(DATA_TEST_ID.HOME_CONTAINER)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.HOME_MAIN_COLUMN)).toBeInTheDocument();
      // AND the hero and CTA sections are rendered
      expect(screen.getByTestId(HERO_DATA_TEST_ID.HOME_HERO)).toBeInTheDocument();
      expect(screen.getByTestId(CTA_DATA_TEST_ID.HOME_CTA_GRID)).toBeInTheDocument();
      // AND the dashboard/job-ready area is rendered
      expect(screen.getByTestId(DATA_TEST_ID.HOME_DASHBOARD_GRID)).toBeInTheDocument();
      expect(screen.getByTestId(JOB_READY_DATA_TEST_ID.HOME_JOB_READY)).toBeInTheDocument();
      // AND the footer collaboration section is visible
      expect(screen.getByTestId(FOOTER_DATA_TEST_ID.FOOTER_COLLABORATION)).toBeInTheDocument();
    });

    test("should show hero headline and path illustration", () => {
      // GIVEN default mocked profile data
      // WHEN the Home page is rendered
      render(<Home />);

      // THEN the hero headline text is displayed
      expect(screen.getByTestId(HERO_DATA_TEST_ID.HOME_HERO_HEADLINE)).toHaveTextContent(/Let's discover/i);
      // AND the path illustration points to the expected public asset
      expect(screen.getByTestId(HERO_DATA_TEST_ID.HOME_HERO_ILLUSTRATION)).toHaveAttribute("src", "/path.svg");
    });

    test("should render three CTA cards with links to skills, career explorer, and job matching", () => {
      // GIVEN default mocked profile data
      // WHEN the Home page is rendered
      render(<Home />);

      // THEN all three CTA cards are present
      expect(screen.getByTestId(`${CTA_DATA_TEST_ID.HOME_CTA_CARD}-profile`)).toBeInTheDocument();
      expect(screen.getByTestId(`${CTA_DATA_TEST_ID.HOME_CTA_CARD}-paths`)).toBeInTheDocument();
      expect(screen.getByTestId(`${CTA_DATA_TEST_ID.HOME_CTA_CARD}-jobs`)).toBeInTheDocument();
    });
  });
});
