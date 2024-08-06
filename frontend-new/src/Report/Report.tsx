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
        <Text style={styles.title} data-testid={DATA_TEST_ID.SKILL_REPORT_TITLE}>
          Skill Report
        </Text>
        <View style={styles.body} data-testid={DATA_TEST_ID.SKILL_REPORT_BODY}>
          <View style={styles.row}>
            <View style={styles.column}>
              {name && (
                <Text style={styles.subtitle} data-testid={DATA_TEST_ID.SKILL_REPORT_NAME}>
                  {name}
                </Text>
              )}
              {email && (
                <View style={styles.rowView} data-testid={DATA_TEST_ID.SKILL_REPORT_EMAIL}>
                  <Text style={styles.boldText}>Email: </Text>
                  <Text style={styles.text}> {email}</Text>
                </View>
              )}
            </View>
            <View style={styles.column}>
              {phone && (
                <View style={styles.rowView} data-testid={DATA_TEST_ID.SKILL_REPORT_PHONE}>
                  <Text style={styles.boldText}>Phone: </Text>
                  <Text style={styles.text}>{phone}</Text>
                </View>
              )}
              {address && (
                <View style={styles.rowView} data-testid={DATA_TEST_ID.SKILL_REPORT_ADDRESS}>
                  <Text style={styles.boldText}>Address: </Text>
                  <Text style={styles.text}>{address}</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.bodyText} data-testid={DATA_TEST_ID.SKILL_REPORT_BODY_TEXT}>
            This report provides insights gathered by Compass Tabiya's AI chatbot, Lorem ipsum dolor sit amet,
            consectetur adipiscing elit. Nam nec pretium turpis. Nulla porttitor faucibus massa, in convallis urna
            commodo sed. Nullam ut convallis augue, nec aliquam justo. Praesent imperdiet facilisis dui sed sagittis. Ut
            in gravida purus. Sed ornare pharetra purus, mattis feugiat quam. Aliquam ac vulputate lectus. Aenean ornare
            eros a tellus convallis, et convallis lacus luctus. Ut at dapibus dui, quis convallis nulla. Quisque eget
            velit molestie, placerat justo in, dignissim dolor.
          </Text>
          <Text style={styles.experiencesTitle} data-testid={DATA_TEST_ID.SKILL_REPORT_EXPERIENCES_TITLE}>
            EXPERIENCES
          </Text>
          <View style={styles.experiencesContainer} data-testId={DATA_TEST_ID.SKILL_REPORT_EXPERIENCES_CONTAINER}>
            {experiences.map((experience, index) => (
              <ExperiencesReportContent key={index} experience={experience} />
            ))}
          </View>
        </View>
        {experiences.length > 5 && (
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            fixed
          />
        )}
        <View fixed style={styles.imageContainer}>
          <Image src={`${process.env.PUBLIC_URL}/future-development.png`} style={styles.image} />
          <Image src={`${process.env.PUBLIC_URL}/oxford.jpg`} style={styles.image} />
          <Image src={`${process.env.PUBLIC_URL}/logo.jpg`} style={styles.compassImage} />
        </View>
      </Page>
    </Document>
  );
};

export default SkillReport;
