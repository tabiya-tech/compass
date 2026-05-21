import type { Meta, StoryObj } from "@storybook/react";
import SkillsAnalytics from "src/components/SkillsAnalytics/SkillsAnalytics";
import { getBackendUrl } from "src/envService";

// URL constants for mocked endpoints
const ANALYTICS_JOB_DEMAND_URL = getBackendUrl() + "/analytics/job-demand-stats?limit=5";
const ANALYTICS_SKILLS_SUPPLY_URL = getBackendUrl() + "/analytics/skills-supply-stats?limit=5";

const meta: Meta<typeof SkillsAnalytics> = {
  title: "Dashboard/SkillsAnalytics",
  component: SkillsAnalytics,
  tags: ["autodocs"],
  parameters: {
    mockData: [
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
            { skill_label: "Teamwork", jobs_count: 78 },
            { skill_label: "Data Analysis", jobs_count: 70 },
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
            { skill_id: "s4", skill_label: "Critical Thinking", student_count: 94, avg_score: 0.67 },
          ],
        },
      },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof SkillsAnalytics>;

export const Shown: Story = {};
