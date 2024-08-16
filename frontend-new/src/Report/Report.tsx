import React from "react";
import { Document, Text, Page, View, Image } from "@react-pdf/renderer";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import ExperiencesReportContent from "src/Report/ExperiencesReportContent/ExperiencesReportContent";
import styles from "src/Report/styles";

interface SkillReportProps {
  name: string;
  email: string;
  phone: string;
  address: string;
  experiences: Experience[];
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

const SkillReport: React.FC<SkillReportProps> = ({ name, email, phone, address, experiences }) => {
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
            This report summarizes the key information gathered during a conversation with Compass on [insert date].
            Compass by Tabiya is an AI chatbot that assists job-seekers in exploring their skills and experiences. This
            report presents the candidate’s work experience and the skills identified from each experience. This
            information can be used to guide job search and highlight their skills when applying for jobs, especially
            during interviews with potential employers. It can be a good starting point for creating a complete CV.
          </Text>
          <View style={styles.divider} />
          <Text style={styles.experiencesTitle} data-testid={DATA_TEST_ID.SKILL_REPORT_EXPERIENCES_TITLE}>
            EXPERIENCES
          </Text>
          <View style={styles.experiencesContainer} data-testId={DATA_TEST_ID.SKILL_REPORT_EXPERIENCES_CONTAINER}>
            {experiences.map((experience, index) => (
              <ExperiencesReportContent key={index} experience={experience} />
            ))}
          </View>
        </View>
        <View fixed style={styles.disclaimerContainer}>
          <Image src={`${process.env.PUBLIC_URL}/danger.png`} style={styles.disclaimerIcon} />
          <Text style={styles.disclaimerText}>
            {" "}
            Disclaimer:{" "}
            <Text style={styles.disclaimerTextBold}>
              Listed skills are based on a conversation with the candidate, are not verified or validated by Tabiya, and
              may be inaccurate.{" "}
            </Text>
            Information should be checked before use for job search, job interviews, or for creating a CV. To revise
            this information, speak with Compass again or create a complete CV based on this report.
          </Text>
        </View>
        {experiences.length > 5 && (
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            fixed
          />
        )}
      </Page>
    </Document>
  );
};

export default SkillReport;
