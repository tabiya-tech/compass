import { SkillsRankingService } from "./skillsRankingService/skillsRankingService";

export const SKILLS_RANKING_FEATURE_ID = "4b0c7428-9c01-4688-81fd-d3ef159bce79";

// Typing durations for different components
export const MESSAGE_DURATION_MS = 5000;
export const CALCULATION_DELAY = 60000;
export const EFFORT_METRICS_UPDATE_INTERVAL = 10000;

// Puzzle constants
export const DEFAULT_STRINGS = ["TRSLKGJDFV", "ZCRSLKJTFV", "DFGLKJTRSV", "KJTRSLDFGV", "LKGJFDTRSV"];

// Config constants - these values are unlikely to change during runtime
export const getJobPlatformUrl = () => SkillsRankingService.getInstance().getConfig().config.jobPlatformUrl;
export const getCompensationAmount = () => SkillsRankingService.getInstance().getConfig().config.compensationAmount;

// Typing duration config getters
export const getShortTypingDurationMs = () => SkillsRankingService.getInstance().getConfig().config.shortTypingDurationMs;
export const getDefaultTypingDurationMs = () => SkillsRankingService.getInstance().getConfig().config.defaultTypingDurationMs;
export const getLongTypingDurationMs = () => SkillsRankingService.getInstance().getConfig().config.longTypingDurationMs;

// TODO: this shouldnt be here. ideally we either get this from the backend or we map uuids
// either way we ought to remove this on first opportunity
export const SKILL_GROUP_DESCRIPTIONS: Record<string, string> = {
  "social and communication skills and competences":
    "Empathetic communication, goal coordination, support for well-being, and leadership.",
  "management skills":
    "Managing people, activities, resources, and organisation; developing objectives and strategies, organising work activities, allocating and controlling resources and leading.",
  "assisting and caring":
    "Providing care and support while upholding compliance requirements.",
  "self-management skills and competences":
    "Self-awareness, responsibility, adaptability, receptiveness to feedback, and commitment to growth.",
  "information skills": "Research, record-keeping, analysis, and outcome projection.",
  "thinking skills and competences":
    "Information analysis, synthesis, evaluation, and application for planning, problem-solving, and goal achievement.",
  "life skills and competences":
    "Transversal knowledge application in health, environment, civic engagement, culture, finance, and citizenship.",
  "working with computers":
    "ICT development and maintenance, data management and analysis, collaboration, and content creation.",
  "business, administration and law":
    "Managing organizations, legal frameworks, and administrative processes.",
  "handling and moving": "Material handling and processing; plant, crop, and animal care.",
  services:
    "Delivering customer-oriented services, including client support, hospitality, and community-focused assistance.",
  education: "Education science and teacher training.",
  "engineering, manufacturing and construction":
    "Knowledge and qualifications on designing, building, and maintaining machines, and industrial systems.",
  "health and welfare":
    "Knowledge and qualifications in health and welfare, medicine, nursing or pharmacy.",
  "working with machinery and specialised equipment":
    "Vehicle, machinery, and precision equipment operation and monitoring.",
  "social sciences, journalism and information":
    "Research, analysis, and communication in social sciences and journalism.",
  "arts and humanities":
    "Creative and cultural study of art, history, philosophy, and human expression.",
  "physical and manual skills and competences":
    "Manual dexterity, physical strength, and endurance in demanding environments.",
  constructing: "Building, repairing, installing and finishing interior and exterior structures.",
  "information and communication technologies (icts)":
    "Knowledge on ICT systems, software and network management, and interdisciplinary digital applications.",
  "natural sciences, mathematics and statistics":
    "Studying and applying scientific, mathematical, and statistical methods to understand and explain natural phenomena.",
  "agriculture, forestry, fisheries and veterinary":
    "Studying and protecting natural environments and wildlife, including conservation and national park management.",
  "communication, collaboration and creativity":
    "Problem-solving, designing, creating, performing, and teaching.",
};
