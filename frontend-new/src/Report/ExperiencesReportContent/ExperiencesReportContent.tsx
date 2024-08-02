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
  const formattedSkills = experience.top_skills.map((skill) => skill.preferredLabel).join(", ");

  return (
    <View style={styles.container} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_CONTAINER}>
      <Text style={styles.firstColumn} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_DATE}>
        {experience.end_date && experience.start_date
          ? `${experience.start_date} — ${experience.end_date}`
          : experience.start_date || experience.end_date}
      </Text>
      <View style={styles.secondColumn}>
        <View>
          <Text style={styles.experienceTitle} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_EXPERIENCE_TITLE}>
            {experience.experience_title}
          </Text>
        </View>
        <View>
          <Text style={styles.rowView} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_SKILLS}>
            <Text style={styles.darkText}>Top Skills: </Text>
            <Text style={styles.text}>{formattedSkills}</Text>
          </Text>
        </View>
      </View>
    </View>
  );
};

export default ExperiencesReportContent;
