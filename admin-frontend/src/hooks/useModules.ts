import type { ModuleData } from "src/types";
import { useCareerReadinessStats } from "src/hooks/useCareerReadinessStats";
import type { CareerReadinessFilters } from "src/hooks/useCareerReadinessStats";
import { useSkillsDiscoveryStats } from "src/hooks/useSkillsDiscoveryStats";
import { useCareerExplorerStats } from "src/hooks/useCareerExplorerStats";
import { getModuleLabelKey } from "src/constants";

export interface UseModulesResult {
  modules: ModuleData[];
  loading: boolean;
  error: Error | null;
}

export function useModules(filters?: CareerReadinessFilters): UseModulesResult {
  const { data: crData, loading: crLoading, error: crError } = useCareerReadinessStats(filters);
  const { data: sdData, loading: sdLoading, error: sdError } = useSkillsDiscoveryStats(filters);
  const { data: ceData, loading: ceLoading, error: ceError } = useCareerExplorerStats(filters);

  const loading = crLoading || sdLoading || ceLoading;
  const error = crError || sdError || ceError;

  const modules: ModuleData[] = [];

  // Skills Discovery card
  if (sdData) {
    const totalStudents = sdData.total_registered_students;
    const started = sdData.started.count;
    const completed = sdData.completed.count;
    const inProgress = sdData.in_progress_count;

    modules.push({
      id: "skills-discovery",
      titleKey: "dashboard.modules.titles.skillsDiscovery",
      tooltipKey: "dashboard.modules.titles.skillsDiscoveryTooltip",
      totalStudents,
      summary: [
        {
          labelKey: "dashboard.modules.started",
          value: started,
          total: totalStudents,
          pct: totalStudents > 0 ? Math.round((started / totalStudents) * 100) : 0,
          showBar: true,
        },
        {
          labelKey: "dashboard.modules.completed",
          value: completed,
          total: started,
          pct: started > 0 ? Math.round((completed / started) * 100) : 0,
          showBar: true,
        },
      ],
      breakdownType: "funnel",
      breakdownTitleKey: "dashboard.modules.engagementFunnel",
      breakdownCaption: `${inProgress} students in progress`,
      breakdownItems: sdData.funnel.map((stage) => ({
        labelKey: stage.label,
        value: stage.count,
        total: stage.total,
      })),
    });
  }

  // Career Readiness card
  if (crData) {
    const totalStudents = crData.total_registered_students;
    const started = crData.started.count;
    const completedAll = crData.completed_all_modules.count;
    const avgCompleted = crData.avg_modules_completed;
    const totalModules = crData.total_modules;

    modules.push({
      id: "career-readiness",
      titleKey: "dashboard.modules.titles.careerReadiness",
      tooltipKey: "dashboard.modules.titles.careerReadinessTooltip",
      totalStudents,
      summary: [
        {
          labelKey: "dashboard.modules.started",
          value: started,
          total: totalStudents,
          pct: totalStudents > 0 ? Math.round((started / totalStudents) * 100) : 0,
          showBar: true,
        },
        {
          labelKey: "dashboard.modules.completedAll5",
          value: completedAll,
          total: started,
          pct: started > 0 ? Math.round((completedAll / started) * 100) : 0,
          showBar: true,
        },
        {
          labelKey: "dashboard.modules.avgSubModulesCompleted",
          value: avgCompleted,
          total: totalModules,
          pct: 0,
          showBar: false,
        },
      ],
      breakdownType: "subModules",
      breakdownTitleKey: "dashboard.modules.subModuleBreakdown",
      breakdownItems: crData.module_breakdown.map((m) => ({
        labelKey: getModuleLabelKey(m.module_id) ?? m.module_title,
        value: m.completed_count,
        total: m.started_count,
      })),
    });
  }

  // Career Explorer card
  if (ceData) {
    const totalStudents = ceData.total_registered_students;
    const started = ceData.started.count;
    const returned = ceData.returned_2_plus.count;
    const sectorUsersTotal = ceData.priority_sector_users + ceData.non_priority_sector_users;

    modules.push({
      id: "career-explorer",
      titleKey: "dashboard.modules.titles.careerExplorer",
      tooltipKey: "dashboard.modules.titles.careerExplorerTooltip",
      totalStudents,
      summary: [
        {
          labelKey: "dashboard.modules.started",
          value: started,
          total: totalStudents,
          pct: totalStudents > 0 ? Math.round((started / totalStudents) * 100) : 0,
          showBar: true,
        },
        {
          labelKey: "dashboard.modules.returned2Plus",
          value: returned,
          total: started,
          pct: started > 0 ? Math.round((returned / started) * 100) : 0,
          showBar: true,
        },
        {
          labelKey: "dashboard.modules.prioritySectors",
          value: ceData.priority_sector_users,
          total: sectorUsersTotal > 0 ? sectorUsersTotal : started,
          pct: 0,
          showBar: false,
        },
      ],
      breakdownType: "topSectors",
      breakdownTitleKey: "dashboard.modules.topSectorsExplored",
      breakdownItems: (() => {
        const totalUsers = ceData.top_sectors.reduce((sum, s) => sum + s.unique_users, 0) || 1;
        const main = ceData.top_sectors.filter((s) => (s.unique_users / totalUsers) * 100 >= 2);
        const small = ceData.top_sectors.filter((s) => (s.unique_users / totalUsers) * 100 < 2);
        const items = main.map((s) => ({
          labelKey: s.sector_name,
          value: s.unique_users,
          total: totalUsers,
          percentage: Math.round((s.unique_users / totalUsers) * 100),
          color: s.is_priority ? "primary" : "secondary",
        }));
        if (small.length > 0) {
          const othersValue = small.reduce((sum, s) => sum + s.unique_users, 0);
          items.push({
            labelKey: "dashboard.modules.sectors.others",
            value: othersValue,
            total: totalUsers,
            percentage: Math.round((othersValue / totalUsers) * 100),
            color: "secondary",
          });
        }
        return items;
      })(),
    });
  }

  return { modules, loading, error };
}
