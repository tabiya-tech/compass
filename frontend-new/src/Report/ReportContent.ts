export const ReportContent = {
  SKILLS_REPORT_TITLE: "Skills Report",
  SKILLS_DESCRIPTION_TITLE: "Skills Description",
  EXPERIENCES_TITLE: "EXPERIENCES",
  SELF_EMPLOYMENT_TITLE: "Self-Employment",
  SALARY_WORK_TITLE: "Salary Work",
  UNPAID_WORK_TITLE: "Unpaid Work",
  TOP_SKILLS_TITLE: "Top Skills: ",
  SKILLS_DESCRIPTION_TEXT:
    "Below, you will find a list of the skills discovered during your conversation with Compass, along with their descriptions.",
  DISCLAIMER_TEXT_PART1: "Disclaimer: ",
  DISCLAIMER_TEXT_PART2:
    "Listed skills are based on a conversation with the candidate, are not verified or validated by Tabiya, and may be inaccurate. ",
  DISCLAIMER_TEXT_PART3:
    "Information should be checked before use for job search, job interviews, or for creating a CV. To revise this information, speak with Compass again or create a complete CV based on this report.",
  REPORT_BODY_TEXT: (currentDate: string) =>
    `This report summarizes the key information gathered during a conversation with Compass on
  ${currentDate}. Compass is an AI chatbot that assists job-seekers in exploring their skills 
  and experiences. This report presents the candidate’s work experience and the skills identified 
  from each experience. This information can be used to guide job search and highlight their skills 
  when applying for jobs, especially during interviews with potential employers. It can be a good
  starting point for creating a complete CV.`,
  IMAGE_URLS: {
    COMPASS_LOGO: `${process.env.PUBLIC_URL}/logo.png`,
    OXFORD_LOGO: `${process.env.PUBLIC_URL}/oxford-logo.png`,
    LOCATION_ICON: `${process.env.PUBLIC_URL}/location.png`,
    PHONE_ICON: `${process.env.PUBLIC_URL}/phone-call.png`,
    EMAIL_ICON: `${process.env.PUBLIC_URL}/email.png`,
    BRIEFCASE_ICON: `${process.env.PUBLIC_URL}/briefcase.png`,
    DOLLAR_BAG_ICON: `${process.env.PUBLIC_URL}/dollar-bag.png`,
    FRIENDLY_ICON: `${process.env.PUBLIC_URL}/friendly.png`,
    DANGER_ICON: `${process.env.PUBLIC_URL}/danger.png`,
  },
};
