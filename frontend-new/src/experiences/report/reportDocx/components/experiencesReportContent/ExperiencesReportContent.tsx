import { Paragraph, TextRun } from "docx";
import { Experience } from "src/experiences/experienceService/experiences.types";
import { capitalizeFirstLetter } from "src/experiences/report/reportPdf/components/experiencesReportContent/ExperiencesReportContent";
import { ReportContent } from "src/experiences/report/reportContent";
import { COLORS } from "src/experiences/report/util";
import { ReportConfig } from "src/experiences/report/config/types";

// Number of skills that must always stay on the same page as "Top Skills" title
const PINNED_SKILLS_COUNT = 2;

export const generateExperience = (experience: Experience, reportConfig: ReportConfig): Paragraph[] => {
  const { experienceDetails } = reportConfig;
  const paragraphs: Paragraph[] = [];

  const displayTitle = experience.normalized_experience_title ?? experience.experience_title;
  // Title
  if (experienceDetails.title) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: displayTitle,
            color: "#000000",
            bold: true,
            size: 24,
          }),
        ],
        spacing: {
          after: 100,
          before: 300,
        },
        keepNext: true,
      })
    );
  }

  // Date, company, location info line
  const showDateRange = experienceDetails.dateRange && (experience.timeline.start || experience.timeline.end);
  const showCompany = experienceDetails.companyName && experience.company;
  const showLocation = experienceDetails.location && experience.location;

  if (showDateRange || showCompany || showLocation) {
    const infoChildren: TextRun[] = [];

    if (showDateRange) {
      infoChildren.push(
        new TextRun({
          text:
            experience.timeline.end && experience.timeline.start
              ? `${experience.timeline.start} — ${experience.timeline.end}`
              : experience.timeline.start || experience.timeline.end,
          color: COLORS.textBlack,
          size: 20,
        })
      );
    }

    if (showDateRange && showCompany) {
      infoChildren.push(new TextRun({ text: ", " }));
    }

    if (showCompany) {
      infoChildren.push(
        new TextRun({
          text: experience.company!,
          color: COLORS.textBlack,
          size: 20,
        })
      );
    }

    if (showLocation) {
      infoChildren.push(
        new TextRun({
          text: ` (${experience.location})`,
          color: COLORS.textBlack,
          size: 20,
          italics: true,
        })
      );
    }

    paragraphs.push(
      new Paragraph({
        children: infoChildren,
        spacing: {
          after: 100,
        },
      })
    );
  }

  // Summary
  if (experienceDetails.summary && experience.summary) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: experience.summary,
            color: COLORS.textBlack,
            size: 22,
          }),
        ],
        spacing: {
          after: 100,
        },
      })
    );
  }

  // Skills (always shown)
  const skillsCount = experience.top_skills.length;
  paragraphs.push(
    new Paragraph({
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
      keepNext: skillsCount > 0,
    })
  );

  const skillsList = experience.top_skills.map(
    (skill, index) =>
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
        keepNext: index < PINNED_SKILLS_COUNT - 1 && index + 1 < skillsCount,
      })
  );

  paragraphs.push(...skillsList);

  return paragraphs;
};
