import React from "react";
import { Document, Text, Page, View, Image as DefaultImage, ImageWithSrcProp } from "@react-pdf/renderer";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import { formatDate, getBase64Image, getUniqueSkills, groupExperiencesByWorkType, prettifyText } from "src/Report/util";
import { ReportContent } from "src/Report/ReportContent";
import Footer from "src/Report/ReactPdf/components/Footer";
import ExperiencesReportContent from "src/Report/ReactPdf/components/ExperiencesReportContent/ExperiencesReportContent";
import SkillsDescription from "src/Report/ReactPdf/components/SkillsDescription";
import styles from "src/Report/ReactPdf/styles";

interface SkillReportProps {
  name: string;
  email: string;
  phone: string;
  address: string;
  experiences: Experience[];
  conversationConductedAt: string | null;
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

export const Image = (props: ImageWithSrcProp) => <DefaultImage {...props} />;

const SkillReport: React.FC<SkillReportProps> = ({
  name,
  email,
  phone,
  address,
  experiences,
  conversationConductedAt,
}) => {
  // Group experiences by work type
  const { selfEmploymentExperiences, salaryWorkExperiences, unpaidWorkExperiences, traineeWorkExperiences } =
    groupExperiencesByWorkType(experiences);

  // list of all unique skills
  const skillsList = getUniqueSkills(experiences);

  // Experience category
  const ExperienceCategory = (title: string, icon: string, experiences: Experience[]) =>
    experiences.length > 0 ? (
      <View style={styles.categoryContainer}>
        <View wrap={false}>
          <View style={styles.categoryTitleContainer}>
            <Image src={getBase64Image(icon)} style={styles.categoryIcon} />
            <Text x={0} y={0} style={styles.categoryTitle}>
              {title}
            </Text>
          </View>
          {experiences.slice(0, 1).map((experience, index) => (
            <ExperiencesReportContent key={index} experience={experience} />
          ))}
        </View>
        {experiences.slice(1).map((experience, index) => (
          <ExperiencesReportContent key={index} experience={experience} />
        ))}
      </View>
    ) : null;

  // personal info
  const renderPersonalInfo = (value: string | null, icon: string, dataTestId: string) => {
    if (!value) return null;

    return (
      <View style={styles.rowView} data-testid={dataTestId}>
        <View style={styles.infoIcons}>
          <Image src={getBase64Image(icon)} style={styles.infoIcon} />
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
            <Image src={getBase64Image(ReportContent.IMAGE_URLS.COMPASS_LOGO)} style={styles.compassImage} />
            <Image src={getBase64Image(ReportContent.IMAGE_URLS.OXFORD_LOGO)} style={styles.image} />
          </View>
          <Text x={0} y={0} style={styles.title} data-testid={DATA_TEST_ID.SKILL_REPORT_TITLE}>
            {ReportContent.SKILLS_REPORT_TITLE}
          </Text>
          <View style={styles.column}>
            {name ? (
              <Text x={0} y={0} style={styles.subtitle} data-testid={DATA_TEST_ID.SKILL_REPORT_NAME}>
                {name}
              </Text>
            ) : null}

            {renderPersonalInfo(address, ReportContent.IMAGE_URLS.LOCATION_ICON, DATA_TEST_ID.SKILL_REPORT_ADDRESS)}

            {renderPersonalInfo(phone, ReportContent.IMAGE_URLS.PHONE_ICON, DATA_TEST_ID.SKILL_REPORT_PHONE)}

            {renderPersonalInfo(email, ReportContent.IMAGE_URLS.EMAIL_ICON, DATA_TEST_ID.SKILL_REPORT_EMAIL)}
          </View>
          <Text x={0} y={0} style={styles.bodyText} data-testid={DATA_TEST_ID.SKILL_REPORT_BODY_TEXT}>
            {prettifyText(ReportContent.REPORT_BODY_TEXT(formatDate(conversationConductedAt!)))}
          </Text>
          <View style={styles.divider} />
          <Text x={0} y={0} style={styles.experiencesTitle} data-testid={DATA_TEST_ID.SKILL_REPORT_EXPERIENCES_TITLE}>
            {ReportContent.EXPERIENCES_TITLE}
          </Text>
          <View style={styles.experiencesContainer} data-testid={DATA_TEST_ID.SKILL_REPORT_EXPERIENCES_CONTAINER}>
            {ExperienceCategory(
              ReportContent.SELF_EMPLOYMENT_TITLE,
              ReportContent.IMAGE_URLS.SELF_EMPLOYMENT_ICON,
              selfEmploymentExperiences
            )}

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
          </View>
          <SkillsDescription skillsList={skillsList} />
        </View>
        <Footer experiences={experiences} />
      </Page>
    </Document>
  );
};

export default SkillReport;
