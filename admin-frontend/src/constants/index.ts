export const PLACEHOLDER_SYMBOL = "—";

/**
 * Maps backend `module_id` / last-active module slugs to i18n keys.
 */
export const MODULE_ID_TO_I18N_KEY = {
  "skills-discovery": "dashboard.modules.titles.skillsDiscovery",
  "career-explorer": "dashboard.modules.titles.careerExplorer",
  "professional-identity": "dashboard.modules.professionalIdentity",
  "cv-development": "dashboard.modules.cvDevelopment",
  "cover-letter": "dashboard.modules.coverLetterMotivation",
  "interview-preparation": "dashboard.modules.interviewPreparation",
  "workplace-readiness": "dashboard.modules.workplaceReadiness",
  entrepreneurship: "dashboard.modules.entrepreneurship",
} as const;

/** Translation key for `t()`, or `null` when unknown / empty / placeholder. */
export const getModuleLabelKey = (moduleId: string | null | undefined): string | null => {
  if (!moduleId || moduleId === PLACEHOLDER_SYMBOL) return null;
  return (MODULE_ID_TO_I18N_KEY as Record<string, string>)[moduleId] ?? null;
};
