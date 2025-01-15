import { Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } from "docx";
import { Experience } from "src/experiences/experienceService/experiences.types";
import { generateExperience } from "./experiencesReportContent/ExperiencesReportContent";
import {
  COLORS,
  getBase64Image,
  groupExperiencesByWorkType,
} from "src/experiences/report/util";
import { ReportContent } from "src/experiences/report/reportContent";
import { TabiyaBasicColors } from "src/theme/applicationTheme/applicationTheme";

// Create a paragraph with an image and text
const createParagraphWithImageAndText = async (text: string, imageUrl: string) => {
  return new Paragraph({
    children: [
      new ImageRun({
        data: await getBase64Image(imageUrl),
        transformation: { width: 22, height: 22 },
      }),
      new TextRun({
        text: "\u00A0\u00A0",
      }),
      new TextRun({
        text,
        bold: true,
        size: 26,
        color: COLORS.textBlack,
      }),
    ],
    heading: HeadingLevel.HEADING_6,
    alignment: AlignmentType.LEFT,
    spacing: { before: 300 },
  });
};

// Construct the experiences section header
const constructExperiencesSectionHeader = (paragraphs: Paragraph[]): void => {
  paragraphs.push(new Paragraph({
    children: [
      new TextRun({
        text: ReportContent.EXPERIENCES_TITLE,
        bold: true,
        size: 28,
        color: TabiyaBasicColors.DarkBlue,
      }),
    ],
    heading: HeadingLevel.HEADING_5,
    alignment: AlignmentType.LEFT,
    spacing: { before: 100 },
  }));
};

// Construct the work type section
const constructWorkTypeSection = async (
  paragraphs: Paragraph[],
  experiences: Experience[],
  title: string,
  iconUrl: string
): Promise<void> => {
  if (experiences.length === 0) {
    return;
  }

  paragraphs.push(
    await createParagraphWithImageAndText(title, iconUrl),
    ...experiences.flatMap((experience) => generateExperience(experience)),
  );
};

export const constructExperienceList = async (paragraphs: Paragraph[], experiences: Experience[]) => {
  constructExperiencesSectionHeader(paragraphs);
  // Group experiences by work type
  const { selfEmploymentExperiences, salaryWorkExperiences, unpaidWorkExperiences, traineeWorkExperiences } =
    groupExperiencesByWorkType(experiences);

  // Add work sections for each work type
  await constructWorkTypeSection(
    paragraphs,
    selfEmploymentExperiences,
    ReportContent.SELF_EMPLOYMENT_TITLE,
    ReportContent.IMAGE_URLS.SELF_EMPLOYMENT_ICON
  );

  await constructWorkTypeSection(
    paragraphs,
    salaryWorkExperiences,
    ReportContent.SALARY_WORK_TITLE,
    ReportContent.IMAGE_URLS.EMPLOYEE_ICON
  );

  await constructWorkTypeSection(
    paragraphs,
    unpaidWorkExperiences,
    ReportContent.UNPAID_WORK_TITLE,
    ReportContent.IMAGE_URLS.COMMUNITY_WORK_ICON
  );

  await constructWorkTypeSection(
    paragraphs,
    traineeWorkExperiences,
    ReportContent.TRAINEE_WORK_TITLE,
    ReportContent.IMAGE_URLS.TRAINEE_WORK_ICON
  );
}