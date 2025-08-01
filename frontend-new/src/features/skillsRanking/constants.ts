import { SkillsRankingService } from "./skillsRankingService/skillsRankingService";

export const SKILLS_RANKING_FEATURE_ID = "4b0c7428-9c01-4688-81fd-d3ef159bce79";

// Typing durations for different components
export const TYPING_DURATION_MS = 5000;
export const MESSAGE_DURATION_MS = 5000;
export const CALCULATION_DELAY = 60000;
export const EFFORT_METRICS_UPDATE_INTERVAL = 2000;

// Puzzle constants
export const DEFAULT_STRINGS = ["GJRLK", "FQZNC", "EKJGR", "CJFLQ", "GRKLE"];

// Config constants - these values are unlikely to change during runtime
export const getJobPlatformUrl = () => SkillsRankingService.getInstance().getConfig().config.jobPlatformUrl;
export const getAirtimeBudget = () => SkillsRankingService.getInstance().getConfig().config.airtimeBudget;
