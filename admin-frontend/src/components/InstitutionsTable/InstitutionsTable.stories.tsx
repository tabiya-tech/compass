import type { Meta, StoryObj } from "@storybook/react";
import InstitutionsTable from "src/components/InstitutionsTable/InstitutionsTable";
import type { InstitutionRow } from "src/types";

const meta: Meta<typeof InstitutionsTable> = {
  title: "Dashboard/Institutions/InstitutionsTable",
  component: InstitutionsTable,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof InstitutionsTable>;

const storyInstitutionsFixture: InstitutionRow[] = [
  {
    id: "inst-1",
    institution: "Evelyn Hone College of Applied Arts and Commerce",
    students: 342,
    active7Days: 245,
    skillsDiscoveryStartedPct: 88,
    skillsDiscoveryCompletedPct: 64,
    careerReadinessStartedPct: 71,
    careerReadinessCompletedPct: 42,
    careerExplorerStartedPct: 55,
  },
  {
    id: "inst-2",
    institution: "Lusaka Trades Training Institute",
    students: 281,
    active7Days: 173,
    skillsDiscoveryStartedPct: 81,
    skillsDiscoveryCompletedPct: 59,
    careerReadinessStartedPct: 66,
    careerReadinessCompletedPct: 37,
    careerExplorerStartedPct: 48,
  },
];

export const Shown: Story = {
  args: {
    rows: storyInstitutionsFixture,
  },
};

export const WithNumberedPagination: Story = {
  args: {
    rows: storyInstitutionsFixture,
    page: 4,
    totalPages: 12,
    onPageChange: () => undefined,
  },
};
