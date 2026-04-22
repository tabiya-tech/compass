export const default_scenario = {
  // executor: "shared-iterations",
  executor: "per-vu-iterations",
  vus: 10,
  iterations: 100,
  maxDuration: "10m",
};

const scenarios_map = {
  "get-version": default_scenario,
  "check-invitation-code": default_scenario,
  e2e_skills_elicitation_chat: { ...default_scenario, vus: 1, iterations: 1 },
  "e2e-skills-elicitation-chat": { ...default_scenario, vus: 1, iterations: 1 },
};

export const scenario = (testId) => scenarios_map[testId] || default_scenario;
export const scenarios = scenario;

export const HTTP_TIMEOUT_DEFAULT = "300s"; // 5 minutes
export const FIREBASE_IMITATED_CLIENT = "https://localhost:3000";

export const MAX_TURNS_DEFAULT = 1;
export const GEMINI_TIMEOUT_DEFAULT = "120s"; // 2 minutes
export const GEMINI_MODEL_DEFAULT = "gemini-2.5-pro";
export const CHAT_SLEEP_SECONDS_DEFAULT = 0;
