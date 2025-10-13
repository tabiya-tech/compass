import i18n from "src/i18n/i18n";

export const ReportContent = {
  // Use i18n keys and resolve at call/render time
  get SKILLS_REPORT_TITLE() {
    return i18n.t("experiences_report_skills_report_title");
  },
  get SKILLS_DESCRIPTION_TITLE() {
    return i18n.t("experiences_report_skills_description_title");
  },
  get EXPERIENCES_TITLE() {
    return i18n.t("experiences_report_experiences_title");
  },
  get SELF_EMPLOYMENT_TITLE() {
    return i18n.t("experiences_report_self_employment_title");
  },
  get SALARY_WORK_TITLE() {
    return i18n.t("experiences_report_salary_work_title");
  },
  get UNPAID_WORK_TITLE() {
    return i18n.t("experiences_report_unpaid_work_title");
  },
  get TRAINEE_WORK_TITLE() {
    return i18n.t("experiences_report_trainee_work_title");
  },
  get UNCATEGORIZED_TITLE() {
    return i18n.t("experiences_report_uncategorized_title");
  },
  get TOP_SKILLS_TITLE() {
    return i18n.t("experiences_report_top_skills_title");
  },
  get SKILLS_DESCRIPTION_TEXT() {
    return i18n.t("experiences_report_skills_description_text");
  },
  get DISCLAIMER_TEXT_PART1() {
    return i18n.t("experiences_report_disclaimer_text_part1");
  },
  get DISCLAIMER_TEXT_PART2() {
    return i18n.t("experiences_report_disclaimer_text_part2");
  },
  get DISCLAIMER_TEXT_PART3() {
    return i18n.t("experiences_report_disclaimer_text_part3");
  },
  REPORT_BODY_TEXT: (currentDate: string) =>
    i18n.t("experiences_report_body_text", { date: currentDate }),
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
