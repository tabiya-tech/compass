import React from "react";
import { Document, Text, Page, View, Image } from "@react-pdf/renderer";
import { Experience, WorkType } from "src/Experiences/ExperienceService/Experiences.types";
import ExperiencesReportContent from "src/Report/ExperiencesReportContent/ExperiencesReportContent";
import styles from "src/Report/styles";

interface SkillReportProps {
  name: string;
  email: string;
  phone: string;
  address: string;
  experiences: Experience[];
  conversationCompletedAt: string | null;
}

const uniqueId = "5a296552-f91f-4c38-b88f-542cacaced8e";

export const DATA_TEST_ID = {
  SKILL_REPORT_CONTAINER: `skill-report-container-${uniqueId}`,
  SKILL_REPORT_TITLE: `skill-report-title-${uniqueId}`,
  SKILL_REPORT_BODY: `skill-report-body-${uniqueId}`,
  SKILL_REPORT_NAME: `skill-report-name-${uniqueId}`,
  SKILL_REPORT_EMAIL: `skill-report-email-${uniqueId}`,
  SKILL_REPORT_PHONE: `skill-report-phone-${uniqueId}`,
  SKILL_REPORT_ADDRESS: `skill-report-address-${uniqueId}`,
  SKILL_REPORT_BODY_TEXT: `skill-report-body-text-${uniqueId}`,
  SKILL_REPORT_EXPERIENCES_TITLE: `skill-report-experiences-title-${uniqueId}`,
  SKILL_REPORT_EXPERIENCES_CONTAINER: `skill-report-experiences-container-${uniqueId}`,
};

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

const SkillReport: React.FC<SkillReportProps> = ({
  name,
  email,
  phone,
  address,
  experiences,
  conversationCompletedAt,
}) => {
  const selfEmploymentExperiences = experiences.filter(
    (experience) => experience.work_type === WorkType.SELF_EMPLOYMENT
  );
  const salaryWorkExperiences = experiences.filter(
    (experience) => experience.work_type === WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
  );
  const unpaidWorkExperiences = experiences.filter(
    (experience) =>
      experience.work_type === WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK ||
      experience.work_type === WorkType.UNSEEN_UNPAID
  );

  return (
    <Document data-testid={DATA_TEST_ID.SKILL_REPORT_CONTAINER}>
      <Page size="A4" style={styles.page}>
        <View style={styles.body} data-testid={DATA_TEST_ID.SKILL_REPORT_BODY}>
          <View fixed style={styles.logoContainer}>
            <Image src={`${process.env.PUBLIC_URL}/logo.jpg`} style={styles.compassImage} />
            <Image src={`${process.env.PUBLIC_URL}/oxford-logo.jpg`} style={styles.image} />
          </View>
          <Text style={styles.title} data-testid={DATA_TEST_ID.SKILL_REPORT_TITLE}>
            Skills Report
          </Text>
          <View style={styles.column}>
            {name && (
              <Text style={styles.subtitle} data-testid={DATA_TEST_ID.SKILL_REPORT_NAME}>
                {name}
              </Text>
            )}
            {address && (
              <View style={styles.rowView} data-testid={DATA_TEST_ID.SKILL_REPORT_ADDRESS}>
                <Image src={`${process.env.PUBLIC_URL}/location.png`} style={styles.infoIcon} />
                <Text style={styles.text}> {address}</Text>
              </View>
            )}
            {phone && (
              <View style={styles.rowView} data-testid={DATA_TEST_ID.SKILL_REPORT_PHONE}>
                <Image src={`${process.env.PUBLIC_URL}/phone-call.png`} style={styles.infoIcon} />
                <Text style={styles.text}> {phone}</Text>
              </View>
            )}
            {email && (
              <View style={styles.rowView} data-testid={DATA_TEST_ID.SKILL_REPORT_EMAIL}>
                <Image src={`${process.env.PUBLIC_URL}/email.png`} style={styles.infoIcon} />
                <Text style={styles.text}> {email}</Text>
              </View>
            )}
          </View>
          <Text style={styles.bodyText} data-testid={DATA_TEST_ID.SKILL_REPORT_BODY_TEXT}>
            This report summarizes the key information gathered during a conversation with Compass on{" "}
            {formatDate(conversationCompletedAt!)}. Compass by Tabiya is an AI chatbot that assists job-seekers in
            exploring their skills and experiences. This report presents the candidate’s work experience and the skills
            identified from each experience. This information can be used to guide job search and highlight their skills
            when applying for jobs, especially during interviews with potential employers. It can be a good starting
            point for creating a complete CV.
          </Text>
          <View style={styles.divider} />
          <Text style={styles.experiencesTitle} data-testid={DATA_TEST_ID.SKILL_REPORT_EXPERIENCES_TITLE}>
            EXPERIENCES
          </Text>
          <View style={styles.experiencesContainer} data-testid={DATA_TEST_ID.SKILL_REPORT_EXPERIENCES_CONTAINER}>
            {selfEmploymentExperiences.length > 0 && (
              <View style={styles.categoryContainer}>
                <View wrap={false}>
                  <View style={styles.categoryTitleContainer}>
                    <Image src={`${process.env.PUBLIC_URL}/briefcase.png`} style={styles.categoryIcon} />
                    <Text style={styles.categoryTitle}>Self-Employment</Text>
                  </View>
                  {selfEmploymentExperiences.slice(0, 1).map((experience, index) => (
                    <ExperiencesReportContent key={index} experience={experience} />
                  ))}
                </View>
                {selfEmploymentExperiences.slice(1).map((experience, index) => (
                  <ExperiencesReportContent key={index} experience={experience} />
                ))}
              </View>
            )}
            {salaryWorkExperiences.length > 0 && (
              <View style={styles.categoryContainer}>
                <View wrap={false}>
                  <View style={styles.categoryTitleContainer}>
                    <Image src={`${process.env.PUBLIC_URL}/dollar-bag.png`} style={styles.categoryIcon} />
                    <Text style={styles.categoryTitle}>Salary Work</Text>
                  </View>
                  {salaryWorkExperiences.slice(0, 1).map((experience, index) => (
                    <ExperiencesReportContent key={index} experience={experience} />
                  ))}
                </View>
                {salaryWorkExperiences.slice(1).map((experience, index) => (
                  <ExperiencesReportContent key={index} experience={experience} />
                ))}
              </View>
            )}
            {unpaidWorkExperiences.length > 0 && (
              <View style={styles.categoryContainer}>
                <View wrap={false}>
                  <View style={styles.categoryTitleContainer}>
                    <Image src={`${process.env.PUBLIC_URL}/friendly.png`} style={styles.categoryIcon} />
                    <Text style={styles.categoryTitle}>Unpaid Work</Text>
                  </View>
                  {unpaidWorkExperiences.slice(0, 1).map((experience, index) => (
                    <ExperiencesReportContent key={index} experience={experience} />
                  ))}
                </View>
                {unpaidWorkExperiences.slice(1).map((experience, index) => (
                  <ExperiencesReportContent key={index} experience={experience} />
                ))}
              </View>
            )}
          </View>
        </View>
        <View fixed style={styles.footer}>
          <View style={styles.disclaimerContainer}>
            <Image src={`${process.env.PUBLIC_URL}/danger.png`} style={styles.disclaimerIcon} />
            <Text style={styles.disclaimerText}>
              {" "}
              Disclaimer:{" "}
              <Text style={styles.disclaimerTextBold}>
                Listed skills are based on a conversation with the candidate, are not verified or validated by Tabiya,
                and may be inaccurate.{" "}
              </Text>
              Information should be checked before use for job search, job interviews, or for creating a CV. To revise
              this information, speak with Compass again or create a complete CV based on this report.
            </Text>
          </View>
          {experiences.length > 2 && (
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          )}
        </View>
      </Page>
    </Document>
  );
};

export default SkillReport;
