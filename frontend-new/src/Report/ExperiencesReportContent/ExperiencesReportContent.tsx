import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import styles from "src/Report/styles";

interface ExperienceProps {
  experience: Experience;
}

const uniqueId = "e1f12442-9771-4e78-b3c7-77cd3b2172f8";

export const DATA_TEST_ID = {
  EXPERIENCES_CONTENT_REPORT_CONTAINER: `experiences-content-report-container-${uniqueId}`,
  EXPERIENCES_CONTENT_REPORT_DATE: `experiences-content-report-date-${uniqueId}`,
  EXPERIENCES_CONTENT_REPORT_EXPERIENCE_TITLE: `experiences-content-report-experience-title-${uniqueId}`,
  EXPERIENCES_CONTENT_REPORT_SKILLS: `experiences-content-report-skills-${uniqueId}`,
};

const ExperiencesReportContent: React.FC<ExperienceProps> = ({ experience }) => {
  return (
    <View wrap={false} style={styles.container} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_CONTAINER}>
      <View style={styles.secondColumn}>
        <Text style={styles.experienceTitle} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_EXPERIENCE_TITLE}>
          {experience.experience_title}
        </Text>
        <Text style={styles.date} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_DATE}>
          {experience.end_date && experience.start_date
            ? `${experience.start_date} — ${experience.end_date}`
            : experience.start_date || experience.end_date}
        </Text>
        <View style={styles.chipContainer} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_SKILLS}>
          {experience.top_skills.map((skill) => (
            <View key={skill.UUID} style={styles.chip}>
              <Text style={styles.chipText}>{skill.preferredLabel}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

export default ExperiencesReportContent;
