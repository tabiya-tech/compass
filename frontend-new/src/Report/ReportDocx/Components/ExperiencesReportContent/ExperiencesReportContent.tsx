import { Paragraph, TextRun } from "docx";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import { capitalizeFirstLetter } from "src/Report/ReactPdf/components/ExperiencesReportContent/ExperiencesReportContent";
import { ReportContent } from "src/Report/ReportContent";
import { COLORS } from "src/Report/util";

export const generateContent = (experience: Experience) => {
  const titleParagraph = new Paragraph({
    children: [
      new TextRun({
        text: experience.experience_title,
        color: "#000000",
        bold: true,
        size: 24,
      }),
    ],
    spacing: {
      after: 100,
      before: 300,
    },
  });

  const dateParagraph = new Paragraph({
    children: [
      // display the start and end dates
      new TextRun({
        text:
          experience.end_date && experience.start_date
            ? `${experience.start_date} — ${experience.end_date}`
            : experience.start_date || experience.end_date,
        color: COLORS.textBlack,
        size: 20,
      }),

      ...((experience.start_date || experience.end_date) && experience.company ? [new TextRun({ text: ", " })] : []),

      // display the company if it exists
      ...(experience.company
        ? [
            new TextRun({
              text: experience.company,
              color: COLORS.textBlack,
              size: 20,
            }),
          ]
        : []),

      // display the location if it exists
      ...(experience.location
        ? [
            new TextRun({
              text: ` (${experience.location})`,
              color: COLORS.textBlack,
              size: 20,
              italics: true,
            }),
          ]
        : []),
    ],
    spacing: {
      after: 100,
    },
  });

  const skillsParagraph = new Paragraph({
    children: [
      new TextRun({
        text: ReportContent.TOP_SKILLS_TITLE,
        color: COLORS.textBlack,
        bold: true,
        size: 22,
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
            color: COLORS.textBlack,
            size: 20,
          }),
        ],
        spacing: {
          after: 100,
        },
      })
  );

  return [titleParagraph, dateParagraph, skillsParagraph, ...skillsList];
};
