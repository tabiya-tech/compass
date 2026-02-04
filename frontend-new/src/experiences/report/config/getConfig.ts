import { getSkillsReportOutputConfigEnvVar } from "src/envService";
import { DownloadFormat, SkillsReportOutputConfig } from "./types";
import { defaultSkillsReportOutputConfig } from "./default";

// Helper type to allow deep partial overrides (optional, improves type safety)
export const mergeSkillsReportConfig = (override: any = {}): SkillsReportOutputConfig => {
  return {
    logos: override.logos ?? defaultSkillsReportOutputConfig.logos,
    downloadFormats: override.downloadFormats ?? defaultSkillsReportOutputConfig.downloadFormats,
    report: {
      ...defaultSkillsReportOutputConfig.report,
      ...(override.report || {}),
      summary: {
        ...defaultSkillsReportOutputConfig.report.summary,
        ...(override.report?.summary || {}),
      },
      experienceDetails: {
        ...defaultSkillsReportOutputConfig.report.experienceDetails,
        ...(override.report?.experienceDetails || {}),
      },
    },
  };
};

/**
 * Validates that downloadFormats contains at least one valid format.
 * If empty, returns the default formats.
 *
 * If it encounters any invalid format, it logs a warning and removes it from the list.
 */
const validateDownloadFormats = (formats: DownloadFormat[]): DownloadFormat[] => {
  if (!Array.isArray(formats) || formats.length === 0) {
    console.warn("Empty SKILLS_REPORT_OUTPUT_CONFIG.downloadFormats, falling back to defaults");
    return defaultSkillsReportOutputConfig.downloadFormats;
  }

  // Filter to only valid formats
  const validFormats = formats.filter((f) => Object.values(DownloadFormat).includes(f));

  if (validFormats.length === 0) {
    console.warn("Invalid SKILLS_REPORT_OUTPUT_CONFIG.downloadFormats, falling back to defaults");
    return defaultSkillsReportOutputConfig.downloadFormats;
  }

  if (validFormats.length !== formats.length) {
    console.warn(
      `Some of the SKILLS_REPORT_OUTPUT_CONFIG.downloadFormats were invalid and have been removed. Valid formats: ${validFormats.join(", ")}`
    );
  }

  return validFormats;
};

/**
 * Validates that logos is an array and optionally warns if empty or contains invalid items.
 */
const validateLogos = (logos: any[]): void => {
  if (!Array.isArray(logos)) {
    console.warn("SKILLS_REPORT_OUTPUT_CONFIG.logos must be an array, falling back to defaults");
    return;
  }

  if (logos.length === 0) {
    console.warn("SKILLS_REPORT_OUTPUT_CONFIG.logos is empty");
    return;
  }

  logos.forEach((logo, index) => {
    if (!logo.url) {
      console.warn(`SKILLS_REPORT_OUTPUT_CONFIG.logos[${index}] is missing required property 'url'`);
    }
    if (!logo.docxStyles) {
      console.warn(`SKILLS_REPORT_OUTPUT_CONFIG.logos[${index}] is missing required property 'docxStyles'`);
    }
    if (!logo.pdfStyles) {
      console.warn(`SKILLS_REPORT_OUTPUT_CONFIG.logos[${index}] is missing required property 'pdfStyles'`);
    }
  });
};

export const getSkillsReportOutputConfig = (): SkillsReportOutputConfig => {
  let envValue;
  try {
    envValue = getSkillsReportOutputConfigEnvVar();
  } catch (error) {
    console.error("Failed to read FRONTEND_SKILLS_REPORT_OUTPUT_CONFIG:", error);
    return defaultSkillsReportOutputConfig;
  }

  // No config provided, use defaults
  if (!envValue) {
    console.debug("No FRONTEND_SKILLS_REPORT_OUTPUT_CONFIG provided, falling back to defaults");
    return defaultSkillsReportOutputConfig;
  }

  try {
    const parsedConfig = JSON.parse(envValue) as Partial<SkillsReportOutputConfig>;

    // Deep merge with defaults
    const mergedConfig = mergeSkillsReportConfig(parsedConfig);

    // Validate downloadFormats (fall back to defaults if empty)
    mergedConfig.downloadFormats = validateDownloadFormats(mergedConfig.downloadFormats);

    // Validate logos (warn if invalid but don't fail)
    validateLogos(mergedConfig.logos);

    return mergedConfig;
  } catch (error) {
    console.error("Invalid FRONTEND_SKILLS_REPORT_OUTPUT_CONFIG, falling back to defaults:", error);
    return defaultSkillsReportOutputConfig;
  }
};
