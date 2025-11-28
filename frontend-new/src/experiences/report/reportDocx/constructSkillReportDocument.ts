import { Document, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { Experience } from "src/experiences/experienceService/experiences.types";
import { ReportContent } from "src/experiences/report/reportContent";
import { TabiyaBasicColors } from "src/theme/applicationTheme/applicationTheme";
import {
  COLORS,
  formatSkillsReportDate,
  getBase64Image,
  prettifyText,
} from "src/experiences/report/util";
import constructSkillsDescription from "src/experiences/report/reportDocx/components/ConstructSkillsDescription";
import HeaderComponent from "src/experiences/report/reportDocx/components/Header";
import FooterComponent from "src/experiences/report/reportDocx/components/Footer";
import { constructExperienceList } from "src/experiences/report/reportDocx/components/ConstructExperienceList";

export interface SkillReportDocumentProps {
  name: string;
  email: string;
  phone: string;
  address: string;
  experiences: Experience[];
  conversationConductedAt: string | null;
}

// Create a paragraph with an image
const createParagraphWithImage = async (text: string, imageUrl: string) => {
  return new Paragraph({
    children: [
      new ImageRun({
        data: await getBase64Image(imageUrl),
        transformation: { width: 18, height: 16 },
      }),
      new TextRun({
        text: "\u00A0\u00A0",
      }),
      new TextRun({
        text,
        color: COLORS.textBlack,
        size: 24,
      }),
    ],
    alignment: AlignmentType.LEFT,
    spacing: { after: 50 },
  });
};

// Construct the personal information section
const constructPersonalInformationSection = async (
  paragraphs: Paragraph[],
  name: string | undefined,
  address: string | undefined,
  phone: string | undefined,
  email: string | undefined
) : Promise<void> => {
  if (name) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: name,
            color: COLORS.textBlack,
            bold: true,
            size: 28,
          }),
        ],
        spacing: { after: 100 },
      })
    );
  }

  if (address) {
    paragraphs.push(await createParagraphWithImage(address, ReportContent.IMAGE_URLS.LOCATION_ICON));
  }

  if (phone) {
    paragraphs.push(await createParagraphWithImage(phone, ReportContent.IMAGE_URLS.PHONE_ICON));
  }

  if (email) {
    paragraphs.push(await createParagraphWithImage(email, ReportContent.IMAGE_URLS.EMAIL_ICON));
  }
};

// Construct the report title
const constructReportTitle = (paragraphs: Paragraph[]): void => {
  paragraphs.push(new Paragraph({
    children: [
      new TextRun({
        text: ReportContent.SKILLS_REPORT_TITLE,
        bold: true,
        color: TabiyaBasicColors.DarkBlue,
        size: 32,
      }),
    ],
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.LEFT,
    spacing: { after: 300 },
  }));
};

// Construct the section divider
const constructSectionDivider = (paragraphs: Paragraph[]): void => {
  paragraphs.push(new Paragraph({
    border: {
      top: { style: BorderStyle.SINGLE, size: 10 },
    },
    spacing: { before: 200 },
  }));
};

const constructFinalDisclaimer = (paragraphs: Paragraph[], conversationConductedAt: string | null): void => {
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: prettifyText(ReportContent.DISCLAIMER_FINAL_TEXT(formatSkillsReportDate(conversationConductedAt))),
          size: 20,
          color: COLORS.grey700,
        }),
      ],
      alignment: AlignmentType.LEFT,
      border: {
        top: { style: BorderStyle.SINGLE, size: 8, color: TabiyaBasicColors.GrayDark, space: 10 },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: TabiyaBasicColors.GrayDark, space: 10 },
        left: { style: BorderStyle.SINGLE, size: 8, color: TabiyaBasicColors.GrayDark, space: 10 },
        right: { style: BorderStyle.SINGLE, size: 8, color: TabiyaBasicColors.GrayDark, space: 10 },
      },
      spacing: { before: 300 },
    })
  );
};

export const constructSkillReportDocument = async (props: SkillReportDocumentProps): Promise<Document> => {
  const { name, email, phone, address, experiences, conversationConductedAt } = props;

  const paragraphs: Paragraph[] = [];

  // Add report title section
  constructReportTitle(paragraphs);

  // Add personal information section
  await constructPersonalInformationSection(paragraphs, name, address, phone, email);

  constructSectionDivider(paragraphs);

  // Add the list of experiences
  await constructExperienceList(paragraphs, experiences);

  // Add skills description (Glossary)
  constructSkillsDescription(paragraphs, experiences);

  constructFinalDisclaimer(paragraphs, conversationConductedAt);

  // construct the document
  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Inter",
            color: COLORS.textBlack,
          },
        },
      },
    },
    sections: [
      {
        headers: { default: await HeaderComponent() },
        footers: { default: FooterComponent() },
        properties: {
          page: {
            margin: {
              left: 1000,
              right: 1000,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });
}; 