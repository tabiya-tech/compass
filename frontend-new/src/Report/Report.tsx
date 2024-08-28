import React, { useMemo } from "react";
import { Document, Text, Page, View, Image } from "@react-pdf/renderer";
import { Experience, Skill, WorkType } from "src/Experiences/ExperienceService/Experiences.types";
import ExperiencesReportContent, {
  capitalizeFirstLetter,
} from "src/Report/ExperiencesReportContent/ExperiencesReportContent";
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = { month: "long", day: "2-digit", year: "numeric" };
  return date.toLocaleDateString("en-US", options);
}

const SkillReport: React.FC<SkillReportProps> = ({
                                                   name,
                                                   email,
                                                   phone,
                                                   address,
                                                   experiences,
                                                   conversationCompletedAt,
                                                 }) => {
  const experiencesWithTopSkills = experiences.filter(
    (experience) => experience.top_skills && experience.top_skills.length > 0
  );

  const selfEmploymentExperiences = experiencesWithTopSkills.filter(
    (experience) => experience.work_type === WorkType.SELF_EMPLOYMENT
  );
  const salaryWorkExperiences = experiencesWithTopSkills.filter(
    (experience) => experience.work_type === WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
  );
  const unpaidWorkExperiences = experiencesWithTopSkills.filter(
    (experience) =>
      experience.work_type === WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK ||
      experience.work_type === WorkType.UNSEEN_UNPAID
  );

  // Get a list of all unique skills in alphabetical order
  const skillsList = useMemo(() => {
    const skillOnly: Skill[] = [];
    experiences.forEach((experience) => {
      experience.top_skills.forEach((skill) => {
        if (!skillOnly.find((sk) => sk.preferredLabel === skill.preferredLabel)) {
          skillOnly.push(skill);
        }
        return;
      });
    });
    return skillOnly.sort((a, b) => a.preferredLabel.localeCompare(b.preferredLabel));
  }, [experiences]);

  // show current date if conversation is not completed
  const currentDate = conversationCompletedAt
    ? formatDate(conversationCompletedAt)
    : formatDate(new Date().toLocaleDateString());

  return (
    <Document data-testid={DATA_TEST_ID.SKILL_REPORT_CONTAINER}>
      <Page size="A4" style={styles.page}>
        <View style={styles.body} data-testid={DATA_TEST_ID.SKILL_REPORT_BODY}>
          <View fixed style={styles.logoContainer}>
            <Image src={`${process.env.PUBLIC_URL}/logo.jpg`} style={styles.compassImage} />
            <Image src={`${process.env.PUBLIC_URL}/oxford-logo.jpg`} style={styles.image} />
          </View>
          <Text x={0} y={0} style={styles.title} data-testid={DATA_TEST_ID.SKILL_REPORT_TITLE}>
            Skills Report
          </Text>
          <View style={styles.column}>
            {name ? (
              <Text x={0} y={0} style={styles.subtitle} data-testid={DATA_TEST_ID.SKILL_REPORT_NAME}>
                {name}
              </Text>
            ) : null}
            {address ? (
              <View style={styles.rowView} data-testid={DATA_TEST_ID.SKILL_REPORT_ADDRESS}>
                <Image src={`${process.env.PUBLIC_URL}/location.png`} style={styles.infoIcon} />
                <Text x={0} y={0} style={styles.text}>
                  {address}
                </Text>
              </View>
            ) : null}
            {phone ? (
              <View style={styles.rowView} data-testid={DATA_TEST_ID.SKILL_REPORT_PHONE}>
                <Image src={`${process.env.PUBLIC_URL}/phone-call.png`} style={styles.infoIcon} />
                <Text x={0} y={0} style={styles.text}>
                  {phone}
                </Text>
              </View>
            ) : null}
            {email ? (
              <View style={styles.rowView} data-testid={DATA_TEST_ID.SKILL_REPORT_EMAIL}>
                <Image src={`${process.env.PUBLIC_URL}/email.png`} style={styles.infoIcon} />
                <Text x={0} y={0} style={styles.text}>
                  {email}
                </Text>
              </View>
            ) : null}
          </View>
          <Text x={0} y={0} style={styles.bodyText} data-testid={DATA_TEST_ID.SKILL_REPORT_BODY_TEXT}>
            This report summarizes the key information gathered during a conversation with Compass on {currentDate}.
            Compass is an AI chatbot that assists job-seekers in exploring their skills and experiences. This report
            presents the candidate’s work experience and the skills identified from each experience. This information
            can be used to guide job search and highlight their skills when applying for jobs, especially during
            interviews with potential employers. It can be a good starting point for creating a complete CV.
          </Text>
          <View style={styles.divider} />
          <Text x={0} y={0} style={styles.experiencesTitle} data-testid={DATA_TEST_ID.SKILL_REPORT_EXPERIENCES_TITLE}>
            EXPERIENCES
          </Text>
          <View style={styles.experiencesContainer} data-testid={DATA_TEST_ID.SKILL_REPORT_EXPERIENCES_CONTAINER}>
            {selfEmploymentExperiences.length > 0 ? (
              <View style={styles.categoryContainer}>
                <View wrap={false}>
                  <View style={styles.categoryTitleContainer}>
                    <Image src={`${process.env.PUBLIC_URL}/briefcase.png`} style={styles.categoryIcon} />
                    <Text x={0} y={0} style={styles.categoryTitle}>
                      Self-Employment
                    </Text>
                  </View>
                  {selfEmploymentExperiences.slice(0, 1).map((experience, index) => (
                    <ExperiencesReportContent key={index} experience={experience} />
                  ))}
                </View>
                {selfEmploymentExperiences.slice(1).map((experience, index) => (
                  <ExperiencesReportContent key={index} experience={experience} />
                ))}
              </View>
            ) : null}
            {salaryWorkExperiences.length > 0 ? (
              <View style={styles.categoryContainer}>
                <View wrap={false}>
                  <View style={styles.categoryTitleContainer}>
                    <Image src={`${process.env.PUBLIC_URL}/dollar-bag.png`} style={styles.categoryIcon} />
                    <Text x={0} y={0} style={styles.categoryTitle}>
                      Salary Work
                    </Text>
                  </View>
                  {salaryWorkExperiences.slice(0, 1).map((experience, index) => (
                    <ExperiencesReportContent key={index} experience={experience} />
                  ))}
                </View>
                {salaryWorkExperiences.slice(1).map((experience, index) => (
                  <ExperiencesReportContent key={index} experience={experience} />
                ))}
              </View>
            ) : null}
            {unpaidWorkExperiences.length > 0 ? (
              <View style={styles.categoryContainer}>
                <View wrap={false}>
                  <View style={styles.categoryTitleContainer}>
                    <Image src={`${process.env.PUBLIC_URL}/friendly.png`} style={styles.categoryIcon} />
                    <Text x={0} y={0} style={styles.categoryTitle}>
                      Unpaid Work
                    </Text>
                  </View>
                  {unpaidWorkExperiences.slice(0, 1).map((experience, index) => (
                    <ExperiencesReportContent key={index} experience={experience} />
                  ))}
                </View>
                {unpaidWorkExperiences.slice(1).map((experience, index) => (
                  <ExperiencesReportContent key={index} experience={experience} />
                ))}
              </View>
            ) : null}
          </View>
          <View style={styles.skillDescriptionContainer}>
            <Text x={0} y={0} style={styles.skillDescriptionTitle} break>
              Skills Description
            </Text>
            <Text x={0} y={0} style={styles.info} data-testid={DATA_TEST_ID.SKILL_REPORT_BODY_TEXT}>
              Below, you will find a list of the skills discovered during your conversation with Compass, along with
              their descriptions.
            </Text>
            <View style={styles.skillDivider} />
            {skillsList.map((skill) => (
              <View wrap={false} key={skill.UUID} style={styles.skillContainer}>
                <Text x={0} y={0} style={styles.label}>
                  {capitalizeFirstLetter(skill.preferredLabel)}
                </Text>
                <Text x={0} y={0} style={styles.description}>
                  {skill.description}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <View fixed style={styles.footer}>
          <View style={styles.disclaimerContainer}>
            <Image src={`${process.env.PUBLIC_URL}/danger.png`} style={styles.disclaimerIcon} />
            <Text x={0} y={0} style={styles.disclaimerText}>
              {" "}
              Disclaimer:{" "}
              <Text x={0} y={0} style={styles.disclaimerTextBold}>
                Listed skills are based on a conversation with the candidate, are not verified or validated by Tabiya,
                and may be inaccurate.{" "}
              </Text>
              Information should be checked before use for job search, job interviews, or for creating a CV. To revise
              this information, speak with Compass again or create a complete CV based on this report.
            </Text>
          </View>
          {experiences.length > 2 ? (
            <Text
              x={0}
              y={0}
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            />
          ) : null}
        </View>
      </Page>
    </Document>
  );
};

export default SkillReport;
