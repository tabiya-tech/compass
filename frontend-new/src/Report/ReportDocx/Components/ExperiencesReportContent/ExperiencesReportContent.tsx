import { Paragraph, TextRun } from "docx";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import { capitalizeFirstLetter } from "src/Report/ReactPdf/components/ExperiencesReportContent/ExperiencesReportContent";
import { ReportContent } from "src/Report/ReportContent";

export const generateContent = (experience: Experience) => {
  const titleParagraph = new Paragraph({
    children: [
      new TextRun({
        text: experience.experience_title,
        bold: true,
        size: 24,
      }),
    ],
    spacing: {
      after: 100,
      before: 200,
    },
  });

  const dateParagraph = new Paragraph({
    children: [
      new TextRun({
        text:
          experience.end_date && experience.start_date
            ? `${experience.start_date} — ${experience.end_date}`
            : experience.start_date || experience.end_date,
        size: 20,
      }),
    ],
    spacing: {
      after: 100,
    },
  });

  const skillsParagraph = new Paragraph({
    children: [
      new TextRun({
        text: ReportContent.TOP_SKILLS_TITLE,
        bold: true,
        size: 24,
      }),
    ],
    spacing: {
      after: 100,
    },
  });

  const skillsList = experience.top_skills.map(
    (skill) =>
      new Paragraph({
        children: [
          new TextRun({
            text: `• ${capitalizeFirstLetter(skill.preferredLabel)}`,
            size: 22,
          }),
        ],
        spacing: {
          after: 100,
        },
      })
  );

  return [titleParagraph, dateParagraph, skillsParagraph, ...skillsList];
};
