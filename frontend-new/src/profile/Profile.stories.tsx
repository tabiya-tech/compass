import type { Meta, StoryObj } from "@storybook/react";
import { Profile, ProfileProps } from "./Profile";
import type { ModuleSummary } from "src/careerReadiness/types";

const makeModule = (id: string, status: ModuleSummary["status"]): ModuleSummary => ({
  id,
  title: id,
  description: "",
  icon: "",
  status,
  sort_order: 0,
  input_placeholder: "",
  active_conversation_id: null,
});

/**
 * Creates a complete ProfileProps object with default values and optional overrides.
 * This ensures all required fields are populated and makes it easy to create variations.
 *
 * @param overrides - Partial ProfileProps to override default values
 * @returns Complete ProfileProps object
 */
const createProfileState = (overrides?: Partial<ProfileProps>): ProfileProps => {
  const defaultState: ProfileProps = {
    // Profile fields
    name: "Jane Smith",
    location: "Lusaka, Zambia",
    school: "University of Zambia",
    program: "Computer Science",
    year: "3rd Year",

    // Security fields
    email: "jane.smith@example.com",

    // Preferences fields
    language: "English",
    termsAcceptedDate: new Date("2024-01-15T10:30:00"),

    // Skills and modules
    skills: [
      {
        UUID: "1",
        preferredLabel: "JavaScript",
        description: "Programming language",
        altLabels: ["JS", "ECMAScript"],
        orderIndex: 0,
      },
      {
        UUID: "2",
        preferredLabel: "React",
        description: "Frontend framework",
        altLabels: ["ReactJS"],
        orderIndex: 1,
      },
      {
        UUID: "3",
        preferredLabel: "TypeScript",
        description: "Typed JavaScript",
        altLabels: ["TS"],
        orderIndex: 2,
      },
    ],
    educationSkills: [
      {
        UUID: "e1",
        preferredLabel: "Technical Drawing",
        description: "Engineering drawing skills",
        altLabels: [],
        orderIndex: 0,
      },
      {
        UUID: "e2",
        preferredLabel: "Mathematics",
        description: "Applied mathematics",
        altLabels: ["Maths"],
        orderIndex: 1,
      },
    ],
    modules: [
      makeModule("skills_discovery", "COMPLETED"),
      makeModule("career_discovery", "IN_PROGRESS"),
      makeModule("job_readiness", "UNLOCKED"),
      makeModule("career_explorer", "NOT_STARTED"),
    ],
    skillsInterestsProgress: 75,
    careerExplorerSectors: [],

    // Loading states
    isLoadingSecurity: false,
    isLoadingPreferences: false,
    isLoadingProfile: false,
    isLoadingSkills: false,
    isLoadingCareerExplorer: false,
  };

  return { ...defaultState, ...overrides };
};

const meta: Meta<typeof Profile> = {
  title: "Profile/Profile",
  component: Profile,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof Profile>;

/**
 * Complete profile with all data populated
 */
export const Default: Story = {
  args: createProfileState(),
};

/**
 * Profile with many skills discovered
 */
export const WithManySkills: Story = {
  args: createProfileState({
    skills: [
      { UUID: "1", preferredLabel: "JavaScript", description: "Programming", altLabels: ["JS"], orderIndex: 0 },
      { UUID: "2", preferredLabel: "React", description: "Frontend", altLabels: ["ReactJS"], orderIndex: 1 },
      { UUID: "3", preferredLabel: "TypeScript", description: "Programming", altLabels: ["TS"], orderIndex: 2 },
      { UUID: "4", preferredLabel: "Node.js", description: "Backend", altLabels: ["Node"], orderIndex: 3 },
      { UUID: "5", preferredLabel: "Python", description: "Programming", altLabels: ["Py"], orderIndex: 4 },
      { UUID: "6", preferredLabel: "Data Analysis", description: "Analytics", altLabels: [], orderIndex: 5 },
      { UUID: "7", preferredLabel: "Project Management", description: "Management", altLabels: ["PM"], orderIndex: 6 },
      { UUID: "8", preferredLabel: "Communication", description: "Soft skill", altLabels: [], orderIndex: 7 },
    ],
  }),
};

/**
 * Profile with no skills discovered yet
 */
export const WithNoSkills: Story = {
  args: createProfileState({
    skills: [],
  }),
};

/**
 * Profile with long field values
 */
export const WithLongValues: Story = {
  args: createProfileState({
    name: "Dr. Alexander Christopher Montgomery-Wellington III",
    location: "Kabwe District, Central Province, Republic of Zambia",
    school: "The Copperbelt University School of Mathematics and Natural Sciences",
    program:
      "Bachelor of Science in Computer Science and Information Technology with specialization in Artificial Intelligence and Machine Learning",
    year: "4th Year (Final Year)",
    email: "alexander.christopher.montgomery-wellington@verylongdomainname.co.zm",
    language: "English (British)",
  }),
};

/**
 * Profile with null values (incomplete profile)
 */
export const WithMissingData: Story = {
  args: createProfileState({
    name: null,
    location: null,
    school: "University of Zambia",
    program: null,
    year: null,
  }),
};

/**
 * Completely empty profile (all null values)
 */
export const EmptyProfile: Story = {
  args: createProfileState({
    name: null,
    location: null,
    school: null,
    program: null,
    year: null,
    email: null,
    language: null,
    termsAcceptedDate: null,
    skills: [],
    modules: [],
  }),
};

/**
 * Anonymous user profile (no email or name)
 */
export const AnonymousUser: Story = {
  args: createProfileState({
    name: null,
    email: null,
    termsAcceptedDate: new Date("2024-02-20T14:45:00"),
  }),
};

/**
 * Profile with all sections loading
 */
export const LoadingAll: Story = {
  args: createProfileState({
    isLoadingSecurity: true,
    isLoadingPreferences: true,
    isLoadingProfile: true,
    isLoadingSkills: true,
  }),
};

/**
 * Profile with only profile section loading
 */
export const LoadingProfileSection: Story = {
  args: createProfileState({
    isLoadingProfile: true,
  }),
};

/**
 * Profile with only security section loading
 */
export const LoadingSecuritySection: Story = {
  args: createProfileState({
    isLoadingSecurity: true,
  }),
};

/**
 * Profile with only preferences section loading
 */
export const LoadingPreferencesSection: Story = {
  args: createProfileState({
    isLoadingPreferences: true,
  }),
};

/**
 * Profile with varied module progress
 */
export const WithVariedModuleProgress: Story = {
  args: createProfileState({
    modules: [
      makeModule("skills_discovery", "COMPLETED"),
      makeModule("career_discovery", "COMPLETED"),
      makeModule("job_readiness", "IN_PROGRESS"),
      makeModule("career_explorer", "UNLOCKED"),
      makeModule("knowledge_hub", "NOT_STARTED"),
    ],
  }),
};

/**
 * Profile with no module progress
 */
export const WithNoModules: Story = {
  args: createProfileState({
    modules: [],
  }),
};
