import type { Meta, StoryObj } from "@storybook/react";
import Dashboard from "src/pages/Dashboard/Dashboard";
import { getBackendUrl } from "src/envService";
import type { JobPostingRow, JobPostingStats } from "src/types";

// URL constants for mocked endpoints
const ANALYTICS_STATS_URL = getBackendUrl() + "/analytics/stats";
const ANALYTICS_INSTITUTIONS_URL = getBackendUrl() + "/institutions?limit=20";

const getAdoptionTrendsUrl = () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 6);
  return (
    getBackendUrl() +
    `/analytics/adoption-trends?start_date=${startDate.toISOString().split("T")[0]}&end_date=${endDate.toISOString().split("T")[0]}&interval=day`
  );
};

const ANALYTICS_ADOPTION_TRENDS_URL = getAdoptionTrendsUrl();
const ANALYTICS_SKILLS_DISCOVERY_URL = getBackendUrl() + "/analytics/skills-discovery-stats";
const ANALYTICS_CAREER_READINESS_URL = getBackendUrl() + "/analytics/career-readiness-stats";
const ANALYTICS_JOB_DEMAND_URL = getBackendUrl() + "/analytics/job-demand-stats?limit=5";
const ANALYTICS_SKILLS_SUPPLY_URL = getBackendUrl() + "/analytics/skills-supply-stats?limit=5";

const STORY_JOB_POSTINGS: JobPostingRow[] = [
  {
    id: "job-1",
    jobTitle: "Junior Software Developer",
    sector: "ICT",
    location: "Lusaka",
    zqfLevel: "Level 6",
    platform: "BrighterMonday",
    skills: ["JavaScript", "React", "Git", "Communication"],
    candidatePool: 34,
    jobUrl: "https://example.com/jobs/junior-software-developer",
  },
  {
    id: "job-2",
    jobTitle: "Electrical Technician",
    sector: "Energy",
    location: "Ndola",
    zqfLevel: "Level 5",
    platform: "GoZ Jobs",
    skills: ["Electrical Wiring", "Safety", "Troubleshooting"],
    candidatePool: 21,
    jobUrl: "https://example.com/jobs/electrical-technician",
  },
];

const STORY_JOB_POSTING_STATS: JobPostingStats = {
  jobsSourced: STORY_JOB_POSTINGS.length,
  sectorsCovered: 2,
  sourcePlatformsCount: 2,
};

const meta: Meta<typeof Dashboard> = {
  title: "Dashboard/Page",
  component: Dashboard,
  tags: ["autodocs"],
  parameters: {
    mockData: [
      {
        url: ANALYTICS_STATS_URL,
        method: "GET",
        status: 200,
        response: {
          institutions_active: 12,
          total_students: 342,
          active_students_7_days: 245,
        },
      },
      {
        url: ANALYTICS_INSTITUTIONS_URL,
        method: "GET",
        status: 200,
        response: {
          data: [
            {
              id: "inst-1",
              name: "Evelyn Hone College of Applied Arts and Commerce",
              active: true,
              students: 342,
              active_7_days: 245,
              skills_discovery_started_pct: 88,
              skills_discovery_completed_pct: 64,
              career_readiness_started_pct: 71,
              career_readiness_completed_pct: 42,
            },
          ],
          meta: { limit: 10, next_cursor: null, has_more: false, total: 1 },
        },
      },
      {
        url: ANALYTICS_ADOPTION_TRENDS_URL,
        method: "GET",
        status: 200,
        response: {
          data: [
            { date: "2026-03-17", new_registrations: 22, daily_active_users: 120 },
            { date: "2026-03-18", new_registrations: 18, daily_active_users: 128 },
            { date: "2026-03-19", new_registrations: 30, daily_active_users: 134 },
            { date: "2026-03-20", new_registrations: 25, daily_active_users: 140 },
            { date: "2026-03-21", new_registrations: 19, daily_active_users: 136 },
            { date: "2026-03-22", new_registrations: 28, daily_active_users: 145 },
            { date: "2026-03-23", new_registrations: 24, daily_active_users: 150 },
          ],
          meta: { start_date: "2026-03-17", end_date: "2026-03-23", interval: "day" },
        },
      },
      {
        url: ANALYTICS_SKILLS_DISCOVERY_URL,
        method: "GET",
        status: 200,
        response: {
          total_registered_students: 342,
          started: { count: 301, percentage: 88 },
          completed: { count: 214, percentage: 71 },
          in_progress_count: 87,
          funnel: [
            { label: "dashboard.modules.sharingExperiences", count: 301, total: 342 },
            { label: "dashboard.modules.identifyingSkills", count: 252, total: 301 },
            { label: "dashboard.modules.collectingPreferences", count: 214, total: 252 },
          ],
        },
      },
      {
        url: ANALYTICS_CAREER_READINESS_URL,
        method: "GET",
        status: 200,
        response: {
          total_registered_students: 342,
          started: { count: 245, percentage: 72 },
          completed_all_modules: { count: 98, percentage_of_started: 40 },
          avg_modules_completed: 3,
          total_modules: 5,
          module_breakdown: [
            {
              module_id: "m1",
              module_title: "dashboard.modules.professionalIdentity",
              started_count: 245,
              completed_count: 201,
            },
            {
              module_id: "m2",
              module_title: "dashboard.modules.cvDevelopment",
              started_count: 221,
              completed_count: 180,
            },
            {
              module_id: "m3",
              module_title: "dashboard.modules.interviewPreparation",
              started_count: 192,
              completed_count: 146,
            },
          ],
        },
      },
      {
        url: ANALYTICS_JOB_DEMAND_URL,
        method: "GET",
        status: 200,
        response: {
          total_jobs: 200,
          jobs_with_linked_skills: 180,
          top_skills_in_demand: [
            { skill_label: "Problem Solving", jobs_count: 110 },
            { skill_label: "Communication", jobs_count: 95 },
          ],
        },
      },
      {
        url: ANALYTICS_SKILLS_SUPPLY_URL,
        method: "GET",
        status: 200,
        response: {
          total_students_with_skills: 220,
          top_skills: [
            { skill_id: "s1", skill_label: "Communication", student_count: 132, avg_score: 0.75 },
            { skill_id: "s2", skill_label: "Teamwork", student_count: 118, avg_score: 0.72 },
            { skill_id: "s3", skill_label: "Time Management", student_count: 102, avg_score: 0.69 },
          ],
        },
      },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof Dashboard>;

export const Shown: Story = {
  args: {
    jobPostingRows: STORY_JOB_POSTINGS,
    jobPostingStats: STORY_JOB_POSTING_STATS,
  },
};
