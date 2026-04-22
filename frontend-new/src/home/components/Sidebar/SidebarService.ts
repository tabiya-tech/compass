import CareerExplorerService from "src/careerExplorer/services/CareerExplorerService";
import ExperienceService from "src/experiences/experienceService/experienceService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { DiveInPhase } from "src/experiences/experienceService/experiences.types";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import { getBackendUrl } from "src/envService";
import { customFetch } from "src/utils/customFetch/customFetch";
import { StatusCodes } from "http-status-codes";
import CareerReadinessService from "src/careerReadiness/services/CareerReadinessService";
import type { ModuleStatus } from "src/careerReadiness/types";

// ─── Data types ───────────────────────────────────────────────────────────────

export interface SkillsData {
  skills: string[];
}

export interface SectorItem {
  id?: string;
  emoji: string;
  name: string;
  salaryRange: string;
  description: string;
}

export interface SectorData {
  sectors: SectorItem[];
}

export type ObjectiveStatus = "done" | "active" | "pending";

export interface ObjectiveItem {
  id?: string;
  label: string;
  status: ObjectiveStatus;
}

export interface ObjectivesData {
  objectives: ObjectiveItem[];
}

// ─── Sector emoji map ─────────────────────────────────────────────────────────

const SECTOR_EMOJI_MAP: Record<string, string> = {
  construction: "🏗️",
  engineering: "⚙️",
  agriculture: "🌾",
  retail: "🛒",
  hospitality: "🏨",
  healthcare: "🏥",
  education: "📚",
  finance: "💼",
  transport: "🚛",
  technology: "💻",
  manufacturing: "🏭",
  mining: "⛏️",
  security: "🛡️",
  admin: "📋",
};

const getSectorEmoji = (sectorName: string): string => {
  const key = sectorName.toLowerCase();
  for (const [word, emoji] of Object.entries(SECTOR_EMOJI_MAP)) {
    if (key.includes(word)) return emoji;
  }
  return "🏢";
};

export const moduleStatusToObjectiveStatus = (status: ModuleStatus): ObjectiveStatus => {
  switch (status) {
    case "COMPLETED":
      return "done";
    case "IN_PROGRESS":
      return "active";
    default:
      return "pending";
  }
};

// ─── Service ──────────────────────────────────────────────────────────────────

export default class SidebarService {
  private static instance: SidebarService;

  private constructor() {}

  static getInstance(): SidebarService {
    if (!SidebarService.instance) {
      SidebarService.instance = new SidebarService();
    }
    return SidebarService.instance;
  }

  /**
   * Skills Discovery — returns deduplicated skills from PROCESSED experiences.
   */
  async getSkillsData(): Promise<SkillsData> {
    const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
    if (sessionId === null) return { skills: [] };

    try {
      const experiences = await ExperienceService.getInstance().getExperiences(sessionId, false);
      const seen = new Set<string>();
      const skills: string[] = [];
      for (const exp of experiences) {
        if (exp.exploration_phase !== DiveInPhase.PROCESSED) continue;
        for (const skill of exp.top_skills ?? []) {
          if (!seen.has(skill.preferredLabel)) {
            seen.add(skill.preferredLabel);
            skills.push(skill.preferredLabel);
          }
        }
      }
      return { skills };
    } catch {
      return { skills: [] };
    }
  }

  /**
   * Career Explorer — returns sectors the user has explored.
   */
  async getSectorData(): Promise<SectorData> {
    try {
      const res = await CareerExplorerService.getInstance().getSectorEngagementForUser();
      const sectors = res.data
        .filter((s) => s.inquiry_count > 0)
        .map((s) => ({
          name: s.sector_name,
          emoji: getSectorEmoji(s.sector_name),
          salaryRange: "—",
          description: `Explored in ${s.inquiry_count} conversation${s.inquiry_count !== 1 ? "s" : ""}.`,
        }));
      return { sectors };
    } catch {
      return { sectors: [] };
    }
  }

  /**
   * Career Readiness — returns learning objectives derived from module progress.
   */
  async getObjectivesData(): Promise<ObjectivesData> {
    try {
      const { modules } = await CareerReadinessService.getInstance().listModules();
      const objectives: ObjectiveItem[] = modules.map((m) => ({
        id: m.id,
        label: m.title,
        status: moduleStatusToObjectiveStatus(m.status),
      }));
      return { objectives };
    } catch {
      return { objectives: [] };
    }
  }

  /**
   * Returns the ESCO skills mapped to the user's enrolled programme.
   * Fetched from /users/{user_id}/programme-skills, seeded from the TEVETA xlsx.
   */
  async getProgrammeSkills(): Promise<string[]> {
    const user = authenticationStateService.getInstance().getUser();
    if (!user) return [];
    const url = `${getBackendUrl()}/users/${user.id}/programme-skills`;
    try {
      const response = await customFetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        expectedStatusCode: StatusCodes.OK,
        serviceName: "SidebarService",
        serviceFunction: "getProgrammeSkills",
        failureMessage: "Failed to fetch programme skills",
        expectedContentType: "application/json",
      });
      const body = await response.json();
      return body.skills ?? [];
    } catch {
      return [];
    }
  }
}
