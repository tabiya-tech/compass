import { Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { Skill, Experience } from "src/experiences/experienceService/experiences.types";
import { ReportContent } from "src/experiences/report/reportContent";
import { capitalizeFirstLetter } from "src/experiences/report/reportPdf/components/experiencesReportContent/ExperiencesReportContent";
import { TabiyaBasicColors } from "src/theme/applicationTheme/applicationTheme";
import { getUniqueSkills } from "src/experiences/report/util";

const ConstructSkillsDescription = ( paragraphs: Paragraph[], experiences : Experience[]) => {
  // get all unique skills from the experiences
  const skillsList : Skill[] = getUniqueSkills(experiences);
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: ReportContent.SKILLS_DESCRIPTION_TITLE,
          bold: true,
          size: 28,
          allCaps: true,
          color: TabiyaBasicColors.DarkBlue,
        }),
      ],
      heading: HeadingLevel.HEADING_5,
      alignment: AlignmentType.LEFT,
      spacing: { before: 200, after: 400 },
      pageBreakBefore: true,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: ReportContent.SKILLS_DESCRIPTION_TEXT,
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      border: {
        top: { style: BorderStyle.SINGLE, size: 10 },
      },
      spacing: { before: 200, after: 100 },
    }),
    ...skillsList.map((skill) => {
      return new Paragraph({
        children: [
          new TextRun({
            text: capitalizeFirstLetter(skill.preferredLabel),
            size: 22,
            bold: true,
          }),
          new TextRun({
            text: skill.description,
            size: 20,
            break: 1,
          }),
        ],
        spacing: { after: 200 },
      });
    }),
  );
};

export default ConstructSkillsDescription;
