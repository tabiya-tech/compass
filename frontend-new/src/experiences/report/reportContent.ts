import i18n from "src/i18n/i18n";

// Locale-aware: resolves at call/render time to the user's selected UI language.
// Used by the in-app experiences drawer (and anywhere outside the report tree).
export const ReportContent = {
  // Use i18n keys and resolve at call/render time
  get SKILLS_REPORT_TITLE() {
    return i18n.t("experiences.report.skillsReportTitle");
  },
  get SKILLS_DESCRIPTION_TITLE() {
    return i18n.t("experiences.report.skillsDescriptionTitle");
  },
  get EXPERIENCES_TITLE() {
    return i18n.t("experiences.report.experiencesTitle");
  },
  get SELF_EMPLOYMENT_TITLE() {
    return i18n.t("experiences.report.selfEmploymentTitle");
  },
  get SALARY_WORK_TITLE() {
    return i18n.t("experiences.report.salaryWorkTitle");
  },
  get UNPAID_WORK_TITLE() {
    return i18n.t("experiences.report.unpaidWorkTitle");
  },
  get TRAINEE_WORK_TITLE() {
    return i18n.t("experiences.report.traineeWorkTitle");
  },
  get UNCATEGORIZED_TITLE() {
    return i18n.t("experiences.report.uncategorizedTitle");
  },
  get TOP_SKILLS_TITLE() {
    return i18n.t("experiences.report.topSkillsTitle");
  },
  get SKILLS_DESCRIPTION_TEXT() {
    return i18n.t("experiences.report.skillsDescriptionText");
  },
  get DISCLAIMER_TEXT_PART1() {
    return i18n.t("experiences.report.disclaimer.part1");
  },
  get DISCLAIMER_TEXT_PART2() {
    return i18n.t("experiences.report.disclaimer.part2");
  },
  get DISCLAIMER_TEXT_PART3() {
    return i18n.t("experiences.report.disclaimer.part3");
  },
  REPORT_BODY_TEXT: (currentDate: string) => i18n.t("experiences.report.bodyText", { date: currentDate }),
  IMAGE_URLS: {
    COMPASS_LOGO: `${process.env.PUBLIC_URL}/logo.png`,
    OXFORD_LOGO: `${process.env.PUBLIC_URL}/oxford-logo.png`,
    LOCATION_ICON: `${process.env.PUBLIC_URL}/location.png`,
    PHONE_ICON: `${process.env.PUBLIC_URL}/phone.png`,
    EMAIL_ICON: `${process.env.PUBLIC_URL}/email.png`,
    EMPLOYEE_ICON: `${process.env.PUBLIC_URL}/employee.png`,
    SELF_EMPLOYMENT_ICON: `${process.env.PUBLIC_URL}/self-employment.png`,
    COMMUNITY_WORK_ICON: `${process.env.PUBLIC_URL}/community-work.png`,
    TRAINEE_WORK_ICON: `${process.env.PUBLIC_URL}/trainee-work.png`,
    WARNING_ICON: `${process.env.PUBLIC_URL}/warning.png`,
    QUIZ_ICON: `${process.env.PUBLIC_URL}/quiz.png`,
  },
};

// English-pinned variant. Used by the downloadable Skills Report so the report
// is always English regardless of the user's selected UI language.
const enT = (key: string, options?: Record<string, unknown>): string =>
  i18n.getFixedT("en-GB")(key, options as never) as unknown as string;

export const ReportContentEnglish = {
  get SKILLS_REPORT_TITLE() {
    return enT("experiences.report.skillsReportTitle");
  },
  get SKILLS_DESCRIPTION_TITLE() {
    return enT("experiences.report.skillsDescriptionTitle");
  },
  get EXPERIENCES_TITLE() {
    return enT("experiences.report.experiencesTitle");
  },
  get SELF_EMPLOYMENT_TITLE() {
    return enT("experiences.report.selfEmploymentTitle");
  },
  get SALARY_WORK_TITLE() {
    return enT("experiences.report.salaryWorkTitle");
  },
  get UNPAID_WORK_TITLE() {
    return enT("experiences.report.unpaidWorkTitle");
  },
  get TRAINEE_WORK_TITLE() {
    return enT("experiences.report.traineeWorkTitle");
  },
  get UNCATEGORIZED_TITLE() {
    return enT("experiences.report.uncategorizedTitle");
  },
  get TOP_SKILLS_TITLE() {
    return enT("experiences.report.topSkillsTitle");
  },
  get SKILLS_DESCRIPTION_TEXT() {
    return enT("experiences.report.skillsDescriptionText");
  },
  get DISCLAIMER_TEXT_PART1() {
    return enT("experiences.report.disclaimer.part1");
  },
  get DISCLAIMER_TEXT_PART2() {
    return enT("experiences.report.disclaimer.part2");
  },
  get DISCLAIMER_TEXT_PART3() {
    return enT("experiences.report.disclaimer.part3");
  },
  REPORT_BODY_TEXT: (currentDate: string) => enT("experiences.report.bodyText", { date: currentDate }),
  IMAGE_URLS: ReportContent.IMAGE_URLS,
};
