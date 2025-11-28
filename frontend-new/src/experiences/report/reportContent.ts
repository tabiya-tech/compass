import i18n from "src/i18n/i18n";

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
  DISCLAIMER_FINAL_TEXT: (currentDate: string) =>
    i18n.t("experiences.report.disclaimer.final", { date: currentDate }),
  IMAGE_URLS: {
    COMPASS_LOGO: `${process.env.PUBLIC_URL}/logo.png`,
    OXFORD_LOGO: `${process.env.PUBLIC_URL}/oxford-logo.png`,
    YOUTH_INNOVATION_FUND_LOGO: `${process.env.PUBLIC_URL}/yif.png`,
    EMPUJAR_LOGO: `${process.env.PUBLIC_URL}/empujar-logo.png`,
    PLACEHOLDER_LOGO: `${process.env.PUBLIC_URL}/placeholder-logo.png`,
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
