import { saveAs } from "file-saver";
import { Document, Paragraph, Packer, TextRun, ImageRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import { generateContent } from "src/Report/ReportDocx/Components/ExperiencesReportContent/ExperiencesReportContent";
import { ReportContent } from "src/Report/ReportContent";
import { TabiyaBasicColors } from "src/theme/applicationTheme/applicationTheme";
import {
  COLORS,
  formatDate,
  getBase64Image,
  getUniqueSkills,
  groupExperiencesByWorkType,
  prettifyText,
} from "src/Report/util";
import SkillsDescription from "src/Report/ReportDocx/Components/SkillsDescription";
import HeaderComponent from "src/Report/ReportDocx/Components/Header";
import FooterComponent from "src/Report/ReportDocx/Components/Footer";

interface SkillReportDocxProps {
  name: string;
  email: string;
  phone: string;
  address: string;
  experiences: Experience[];
  conversationConductedAt: string | null;
}

const SkillReportDocx = async (props: SkillReportDocxProps) => {
  const { name, email, phone, address, experiences, conversationConductedAt } = props;
  const header = await HeaderComponent();
  const footer = await FooterComponent();

  // Group experiences by work type
  const { selfEmploymentExperiences, salaryWorkExperiences, unpaidWorkExperiences, traineeWorkExperiences } =
    groupExperiencesByWorkType(experiences);

  // list of all unique skills
  const skillsList = getUniqueSkills(experiences);

  // Create a paragraph with an image
  const createParagraphWithImage = async (text: string, imageUrl: string) => {
    if (!text) return new Paragraph({});
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

  const doc = new Document({
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
        headers: { default: header },
        footers: { default: footer },
        properties: {
          page: {
            margin: {
              left: 1000,
              right: 1000,
            },
          },
        },
        children: [
          new Paragraph({
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
          }),

          name
            ? new Paragraph({
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
            : new Paragraph(""),

          await createParagraphWithImage(address, ReportContent.IMAGE_URLS.LOCATION_ICON),

          await createParagraphWithImage(phone, ReportContent.IMAGE_URLS.PHONE_ICON),

          await createParagraphWithImage(email, ReportContent.IMAGE_URLS.EMAIL_ICON),

          new Paragraph({
            children: [
              new TextRun({
                text: prettifyText(ReportContent.REPORT_BODY_TEXT(formatDate(conversationConductedAt!))),
                size: 22,
              }),
            ],
            alignment: AlignmentType.START,
            spacing: { before: 300, after: 200 },
          }),

          new Paragraph({
            border: {
              top: { style: BorderStyle.SINGLE, size: 10 },
            },
            spacing: { before: 200 },
          }),

          // Experiences
          new Paragraph({
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
          }),

          ...(selfEmploymentExperiences.length > 0
            ? [
                await createParagraphWithImageAndText(
                  ReportContent.SELF_EMPLOYMENT_TITLE,
                  ReportContent.IMAGE_URLS.SELF_EMPLOYMENT_ICON
                ),
                ...selfEmploymentExperiences.flatMap((experience) => generateContent(experience)),
              ]
            : []),

          ...(salaryWorkExperiences.length > 0
            ? [
                await createParagraphWithImageAndText(
                  ReportContent.SALARY_WORK_TITLE,
                  ReportContent.IMAGE_URLS.EMPLOYEE_ICON
                ),
                ...salaryWorkExperiences.flatMap((experience) => generateContent(experience)),
              ]
            : []),

          ...(unpaidWorkExperiences.length > 0
            ? [
                await createParagraphWithImageAndText(
                  ReportContent.UNPAID_WORK_TITLE,
                  ReportContent.IMAGE_URLS.COMMUNITY_WORK_ICON
                ),
                ...unpaidWorkExperiences.flatMap((experience) => generateContent(experience)),
              ]
            : []),

          ...(traineeWorkExperiences.length > 0
            ? [
                await createParagraphWithImageAndText(
                  ReportContent.TRAINEE_WORK_TITLE,
                  ReportContent.IMAGE_URLS.TRAINEE_WORK_ICON
                ),
                ...traineeWorkExperiences.flatMap((experience) => generateContent(experience)),
              ]
            : []),

          // skills description
          ...SkillsDescription({ skillsList }),
        ],
      },
    ],
  });

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, "compass-skills-report.docx");
  });
};

export default SkillReportDocx;
