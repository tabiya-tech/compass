import React from "react";
import { Document, Text, Page, View, Image } from "@react-pdf/renderer";
import { Experience } from "src/experiences/experienceService/experiences.types";
import {
  formatDate,
  getBase64Image,
  getUniqueSkills,
  groupExperiencesByWorkType,
  prettifyText,
} from "src/experiences/report/util";
import { ReportContent } from "src/experiences/report/reportContent";
import Footer from "src/experiences/report/reportPdf/components/Footer";
import ExperiencesReportContent from "src/experiences/report/reportPdf/components/experiencesReportContent/ExperiencesReportContent";
import SkillsDescription from "src/experiences/report/reportPdf/components/SkillsDescription";
import styles from "src/experiences/report/reportPdf/styles";
import { SkillsReportOutputConfig } from "src/experiences/report/config/types";

interface SkillReportProps {
  name: string;
  email: string;
  location: string;
  school: string;
  program: string;
  experiences: Experience[];
  conversationConductedAt: string | null;
  config: SkillsReportOutputConfig;
}

const uniqueId = "5a296552-f91f-4c38-b88f-542cacaced8e";

export const DATA_TEST_ID = {
  SKILL_REPORT_CONTAINER: `skill-report-container-${uniqueId}`,
  SKILL_REPORT_TITLE: `skill-report-title-${uniqueId}`,
  SKILL_REPORT_BODY: `skill-report-body-${uniqueId}`,
  SKILL_REPORT_NAME: `skill-report-name-${uniqueId}`,
  SKILL_REPORT_EMAIL: `skill-report-email-${uniqueId}`,
  SKILL_REPORT_LOCATION: `skill-report-location-${uniqueId}`,
  SKILL_REPORT_EDUCATION: `skill-report-education-${uniqueId}`,
  SKILL_REPORT_BODY_TEXT: `skill-report-body-text-${uniqueId}`,
  SKILL_REPORT_EXPERIENCES_TITLE: `skill-report-experiences-title-${uniqueId}`,
  SKILL_REPORT_EXPERIENCES_CONTAINER: `skill-report-experiences-container-${uniqueId}`,
};

const SkillReportPDF: React.FC<SkillReportProps> = ({
  name,
  email,
  location,
  school,
  program,
  experiences,
  conversationConductedAt,
  config,
}) => {
  // Group experiences by work type
  const { salaryWorkExperiences, unpaidWorkExperiences, traineeWorkExperiences, uncategorizedExperiences } =
    groupExperiencesByWorkType(experiences);

  // list of all unique skills
  const skillsList = getUniqueSkills(experiences);

  // Experience category
  const ExperienceCategory = (title: string, icon: string, experiences: Experience[]) => {
    if (experiences.length === 0) return null;

    return (
      <View style={styles.categoryContainer}>
        {experiences.map((experience, index) => (
          <ExperiencesReportContent
            key={experience.UUID}
            experience={experience}
            reportConfig={config.report}
            categoryHeader={index === 0 ? { title, icon } : undefined}
          />
        ))}
      </View>
    );
  };

  // personal info
  const renderPersonalInfo = (value: string | null, icon: string, dataTestId: string) => {
    if (!value) return null;

    return (
      <View style={styles.rowView} data-testid={dataTestId}>
        <View style={styles.infoIcons}>
          <Image src={getBase64Image(icon)} style={styles.infoIcon} source={undefined} />
        </View>
        <Text x={0} y={0} style={styles.text}>
          {value}
        </Text>
      </View>
    );
  };

  return (
    <Document data-testid={DATA_TEST_ID.SKILL_REPORT_CONTAINER}>
      <Page size="A4" style={styles.page}>
        <View style={styles.body} data-testid={DATA_TEST_ID.SKILL_REPORT_BODY}>
          <View fixed style={styles.logoContainer}>
            {config.logos.map((logo, index) => (
              <Image key={`logo-${index}`} src={getBase64Image(logo.url)} style={logo.pdfStyles} source={undefined} />
            ))}
          </View>
          <Text x={0} y={0} style={styles.title} data-testid={DATA_TEST_ID.SKILL_REPORT_TITLE}>
            {ReportContent.SKILLS_REPORT_TITLE}
          </Text>
          <View
            style={{
              ...styles.column,
              paddingBottom: name || location || email || school || program ? 18 : 0, // Remove padding if there is no personal info
            }}
          >
            {name ? (
              <Text x={0} y={0} style={styles.subtitle} data-testid={DATA_TEST_ID.SKILL_REPORT_NAME}>
                {name}
              </Text>
            ) : null}

            {renderPersonalInfo(location, ReportContent.IMAGE_URLS.LOCATION_ICON, DATA_TEST_ID.SKILL_REPORT_LOCATION)}

            {renderPersonalInfo(email, ReportContent.IMAGE_URLS.EMAIL_ICON, DATA_TEST_ID.SKILL_REPORT_EMAIL)}

            {school || program ? (
              <View style={styles.rowView} data-testid={DATA_TEST_ID.SKILL_REPORT_EDUCATION}>
                <View style={styles.infoIcons}>
                  <Image
                    src={getBase64Image(ReportContent.IMAGE_URLS.EDUCATION_ICON)}
                    style={styles.infoIcon}
                    source={undefined}
                  />
                </View>
                <Text x={0} y={0} style={styles.text}>
                  {[program, school].filter(Boolean).join(" · ")}
                </Text>
              </View>
            ) : null}
          </View>
          {config.report.summary.show && (
            <Text x={0} y={0} style={styles.bodyText} data-testid={DATA_TEST_ID.SKILL_REPORT_BODY_TEXT}>
              {prettifyText(ReportContent.REPORT_BODY_TEXT(formatDate(conversationConductedAt)))}
            </Text>
          )}
          <View style={styles.divider} />
          <Text x={0} y={0} style={styles.experiencesTitle} data-testid={DATA_TEST_ID.SKILL_REPORT_EXPERIENCES_TITLE}>
            {ReportContent.EXPERIENCES_TITLE}
          </Text>
          <View style={styles.experiencesContainer} data-testid={DATA_TEST_ID.SKILL_REPORT_EXPERIENCES_CONTAINER}>
            {ExperienceCategory(
              ReportContent.SALARY_WORK_TITLE,
              ReportContent.IMAGE_URLS.EMPLOYEE_ICON,
              salaryWorkExperiences
            )}
            {ExperienceCategory(
              ReportContent.UNPAID_WORK_TITLE,
              ReportContent.IMAGE_URLS.COMMUNITY_WORK_ICON,
              unpaidWorkExperiences
            )}
            {ExperienceCategory(
              ReportContent.TRAINEE_WORK_TITLE,
              ReportContent.IMAGE_URLS.TRAINEE_WORK_ICON,
              traineeWorkExperiences
            )}
            {ExperienceCategory(
              ReportContent.UNCATEGORIZED_TITLE,
              ReportContent.IMAGE_URLS.QUIZ_ICON,
              uncategorizedExperiences
            )}
          </View>
          <SkillsDescription skillsList={skillsList} />
        </View>
        <Footer experiences={experiences} />
      </Page>
    </Document>
  );
};

export default SkillReportPDF;
