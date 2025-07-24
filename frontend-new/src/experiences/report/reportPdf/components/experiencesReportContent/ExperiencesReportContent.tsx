import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { Experience } from "src/experiences/experienceService/experiences.types";
import styles from "src/experiences/report/reportPdf/styles";
import { ReportContent } from "src/experiences/report/reportContent";

interface ExperienceProps {
  experience: Experience;
}

const uniqueId = "e1f12442-9771-4e78-b3c7-77cd3b2172f8";

export const DATA_TEST_ID = {
  EXPERIENCES_CONTENT_REPORT_CONTAINER: `experiences-content-report-container-${uniqueId}`,
  EXPERIENCES_CONTENT_REPORT_DATE: `experiences-content-report-date-${uniqueId}`,
  EXPERIENCES_CONTENT_REPORT_EXPERIENCE_TITLE: `experiences-content-report-experience-title-${uniqueId}`,
  EXPERIENCES_CONTENT_REPORT_SKILLS: `experiences-content-report-skills-${uniqueId}`,
  EXPERIENCES_CONTENT_REPORT_EXPERIENCE_INFO: `experiences-content-report-experience-info-${uniqueId}`,
  EXPERIENCES_CONTENT_REPORT_COMPANY: `experiences-content-report-company-${uniqueId}`,
  EXPERIENCES_CONTENT_REPORT_LOCATION: `experiences-content-report-location-${uniqueId}`,
  EXPERIENCES_CONTENT_REPORT_SUMMARY: `experiences-content-report-summary-${uniqueId}`,
};

export const capitalizeFirstLetter = (string: string): string => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const ExperiencesReportContent: React.FC<ExperienceProps> = ({ experience }) => {
  return (
    <View style={styles.container} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_CONTAINER}>
      <View style={styles.contentColumn}>
        <View wrap={false}>
          <Text
            x={0}
            y={0}
            style={styles.experienceTitle}
            data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_EXPERIENCE_TITLE}
          >
            {experience.experience_title}
          </Text>
          <View style={styles.experienceInfo} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_EXPERIENCE_INFO}>
            <Text x={0} y={0} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_DATE}>
              {experience.timeline.end && experience.timeline.start
                ? `${experience.timeline.start} — ${experience.timeline.end}`
                : experience.timeline.start || experience.timeline.end}
            </Text>
            {(experience.timeline.start || experience.timeline.end) && experience.company && (
              <Text x={0} y={0}>
                ,{" "}
              </Text>
            )}
            <Text x={0} y={0} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_COMPANY}>
              {experience.company && experience.company}
            </Text>
            <Text x={0} y={0} style={styles.location} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_LOCATION}>
              {experience.location && `(${experience.location})`}
            </Text>
          </View>
        </View>
        {experience.summary && (
          <Text x={0} y={0} style={styles.summary} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_SUMMARY}>
            {experience.summary}
          </Text>
        )}
        <View>
          <Text x={0} y={0} style={styles.skillsTitle}>
            {ReportContent.TOP_SKILLS_TITLE}
          </Text>
          <View style={styles.skillsContainer} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_SKILLS}>
            {experience.top_skills.map((skill) => (
              <Text x={0} y={0} key={skill.UUID} style={styles.skillText}>
                • {capitalizeFirstLetter(skill.preferredLabel)}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

export default ExperiencesReportContent;
