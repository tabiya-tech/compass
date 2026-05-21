import type { Meta, StoryObj } from "@storybook/react";
import InstructorDashboard from "src/pages/InstructorDashboard/InstructorDashboard";
import { getBackendUrl } from "src/envService";

// URL constants for mocked endpoints
const ANALYTICS_STATS_URL = getBackendUrl() + "/analytics/stats";
const ANALYTICS_SKILLS_DISCOVERY_URL = getBackendUrl() + "/analytics/skills-discovery-stats";
const ANALYTICS_CAREER_READINESS_URL = getBackendUrl() + "/analytics/career-readiness-stats";
const ANALYTICS_JOB_DEMAND_URL = getBackendUrl() + "/analytics/job-demand-stats?limit=5";
const ANALYTICS_SKILLS_SUPPLY_URL = getBackendUrl() + "/analytics/skills-supply-stats?limit=5";
const STUDENTS_URL = getBackendUrl() + "/students?limit=100";

const meta: Meta<typeof InstructorDashboard> = {
  title: "Instructor Dashboard/Page",
  component: InstructorDashboard,
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
      {
        url: STUDENTS_URL,
        method: "GET",
        status: 200,
        response: {
          data: [
            {
              id: "student-1",
              name: "Chanda Mulenga",
              institution: "Evelyn Hone College of Applied Arts and Commerce",
              province: "Lusaka",
              programme: "Computer Studies",
              year: "Year 2",
              gender: "Female",
              active: true,
              modules_explored: 4,
              career_readiness_modules_explored: 3,
              skills_interests_explored: 67,
              last_login: new Date().toISOString(),
              last_active_module: "career-explorer",
            },
            {
              id: "student-2",
              name: "Brian Phiri",
              institution: "Evelyn Hone College of Applied Arts and Commerce",
              province: "Copperbelt",
              programme: "Electrical Engineering",
              year: "Year 1",
              gender: "Male",
              active: true,
              modules_explored: 5,
              career_readiness_modules_explored: 5,
              skills_interests_explored: 100,
              last_login: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
              last_active_module: "skills-discovery",
            },
            {
              id: "student-3",
              name: "Natasha Banda",
              institution: "Evelyn Hone College of Applied Arts and Commerce",
              province: "Lusaka",
              programme: "Business Administration",
              year: "Year 3",
              gender: "Female",
              active: true,
              modules_explored: 2,
              career_readiness_modules_explored: 0,
              skills_interests_explored: 12,
              last_login: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              last_active_module: "workplace-readiness",
            },
          ],
          meta: { limit: 100, next_cursor: null, has_more: false, total: 3 },
        },
      },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof InstructorDashboard>;

export const Shown: Story = {};
