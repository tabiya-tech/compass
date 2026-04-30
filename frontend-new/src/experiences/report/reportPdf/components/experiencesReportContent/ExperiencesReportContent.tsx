import React from "react";
import { Image, Text, View } from "@react-pdf/renderer";
import { Experience } from "src/experiences/experienceService/experiences.types";
import styles from "src/experiences/report/reportPdf/styles";
import { ReportContent } from "src/experiences/report/reportContent";
import { ReportConfig } from "src/experiences/report/config/types";
import { getBase64Image } from "src/experiences/report/util";

interface CategoryHeader {
  title: string;
  icon: string;
}

interface ExperienceProps {
  experience: Experience;
  reportConfig: ReportConfig;
  categoryHeader?: CategoryHeader;
}

// Number of skills that must always render together with the "Top Skills" title
const PINNED_SKILLS_COUNT = 2;

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

const ExperiencesReportContent: React.FC<ExperienceProps> = ({ experience, reportConfig, categoryHeader }) => {
  const { experienceDetails } = reportConfig;

  // Determine what date info to show based on config
  const showDateRange = experienceDetails.dateRange && (experience.timeline.start || experience.timeline.end);
  const dateRangeText =
    experience.timeline.end && experience.timeline.start
      ? `${experience.timeline.start} — ${experience.timeline.end}`
      : experience.timeline.start || experience.timeline.end;

  // Determine if we should show company name
  const showCompany = experienceDetails.companyName && experience.company;

  // Determine if we should show location
  const showLocation = experienceDetails.location && experience.location;

  // Determine if we should show experience summary
  const showSummary = experienceDetails.summary && experience.summary;

  // Determine if we should show title
  const showTitle = experienceDetails.title;
  const displayTitle = experience.normalized_experience_title ?? experience.experience_title;

  const pinnedSkills = experience.top_skills.slice(0, PINNED_SKILLS_COUNT);
  const remainingSkills = experience.top_skills.slice(PINNED_SKILLS_COUNT);

  return (
    <View style={styles.container} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_CONTAINER}>
      <View wrap={false}>
        {categoryHeader && (
          <View style={styles.categoryTitleContainer}>
            <Image src={getBase64Image(categoryHeader.icon)} style={styles.categoryIcon} source={undefined} />
            <Text x={0} y={0} style={styles.categoryTitle}>
              {categoryHeader.title}
            </Text>
          </View>
        )}
        {showTitle && (
          <Text
            x={0}
            y={0}
            style={styles.experienceTitle}
            data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_EXPERIENCE_TITLE}
          >
            {displayTitle}
          </Text>
        )}
        {(showDateRange || showCompany || showLocation) && (
          <View style={styles.experienceInfo} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_EXPERIENCE_INFO}>
            {showDateRange && (
              <Text x={0} y={0} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_DATE}>
                {dateRangeText}
              </Text>
            )}
            {showDateRange && showCompany && (
              <Text x={0} y={0}>
                ,{" "}
              </Text>
            )}
            {showCompany && (
              <Text x={0} y={0} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_COMPANY}>
                {experience.company}
              </Text>
            )}
            {showLocation && (
              <Text x={0} y={0} style={styles.location} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_LOCATION}>
                ({experience.location})
              </Text>
            )}
          </View>
        )}
      </View>
      {showSummary && (
        <Text x={0} y={0} style={styles.summary} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_SUMMARY}>
          {experience.summary}
        </Text>
      )}
      <View style={styles.skillsContainer} data-testid={DATA_TEST_ID.EXPERIENCES_CONTENT_REPORT_SKILLS}>
        <View wrap={false}>
          <Text x={0} y={0} style={styles.skillsTitle}>
            {ReportContent.TOP_SKILLS_TITLE}
          </Text>
          {pinnedSkills.map((skill) => (
            <Text x={0} y={0} key={skill.UUID} style={[styles.skillText, styles.skillItem]}>
              • {capitalizeFirstLetter(skill.preferredLabel)}
            </Text>
          ))}
        </View>
        {remainingSkills.map((skill) => (
          <Text x={0} y={0} key={skill.UUID} style={[styles.skillText, styles.skillItem]}>
            • {capitalizeFirstLetter(skill.preferredLabel)}
          </Text>
        ))}
      </View>
    </View>
  );
};

export default ExperiencesReportContent;
