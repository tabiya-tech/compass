import { saveAs } from "file-saver";
import { Document, Paragraph, Packer, TextRun, ImageRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import { generateContent } from "src/Report/ReportDocx/Components/ExperiencesReportContent/ExperiencesReportContent";
import { ReportContent } from "src/Report/ReportContent";
import { formatDate, getBase64Image, getUniqueSkills, groupExperiencesByWorkType } from "src/Report/util";
import SkillsDescription from "src/Report/ReportDocx/Components/SkillsDescription";
import HeaderComponent from "src/Report/ReportDocx/Components/Header";
import FooterComponent from "src/Report/ReportDocx/Components/Footer";

interface SkillReportDocxProps {
  name: string;
  email: string;
  phone: string;
  address: string;
  experiences: Experience[];
  conversationCompletedAt: string | null;
}

const SkillReportDocx = async (props: SkillReportDocxProps) => {
  const { name, email, phone, address, experiences, conversationCompletedAt } = props;
  const header = await HeaderComponent();
  const footer = await FooterComponent();

  // Group experiences by work type
  const { selfEmploymentExperiences, salaryWorkExperiences, unpaidWorkExperiences } =
    groupExperiencesByWorkType(experiences);

  // list of all unique skills
  const skillsList = getUniqueSkills(experiences);

  // show current date if conversation is not completed
  const currentDate = conversationCompletedAt
    ? formatDate(conversationCompletedAt)
    : formatDate(new Date().toLocaleDateString());

  // Create a paragraph with an image
  const createParagraphWithImage = async (text: string, imageUrl: string) => {
    if (!text) return new Paragraph({});
    return new Paragraph({
      children: [
        new ImageRun({
          data: await getBase64Image(imageUrl),
          transformation: { width: 16, height: 16 },
        }),
        new TextRun({
          text: "\u00A0\u00A0",
        }),
        new TextRun({
          text,
          size: 24,
        }),
      ],
      alignment: AlignmentType.LEFT,
      spacing: { after: 100 },
    });
  };

  // Create a paragraph with an image and text
  const createParagraphWithImageAndText = async (text: string, imageUrl: string) => {
    return new Paragraph({
      children: [
        new ImageRun({
          data: await getBase64Image(imageUrl),
          transformation: { width: 20, height: 20 },
        }),
        new TextRun({
          text: "\u00A0\u00A0",
        }),
        new TextRun({
          text,
          bold: true,
          size: 26,
          color: "#43474E",
        }),
      ],
      heading: HeadingLevel.HEADING_6,
      alignment: AlignmentType.LEFT,
      spacing: { before: 200 },
    });
  };

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Inter",
            color: "#43474E",
          },
        },
      },
    },
    sections: [
      {
        headers: { default: header },
        footers: { default: footer },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: ReportContent.SKILLS_REPORT_TITLE,
                bold: true,
                color: "#083763",
                size: 36,
              }),
            ],
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.LEFT,
            spacing: { after: 200 },
          }),

          name
            ? new Paragraph({
                children: [
                  new TextRun({
                    text: name,
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
                text: ReportContent.REPORT_BODY_TEXT(currentDate),
                size: 22,
              }),
            ],
            alignment: AlignmentType.START,
            spacing: { before: 200, after: 200 },
          }),

          new Paragraph({
            border: {
              top: { style: BorderStyle.SINGLE, size: 4 },
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
                color: "#083763",
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
                  ReportContent.IMAGE_URLS.BRIEFCASE_ICON
                ),
                ...selfEmploymentExperiences.flatMap((experience) => generateContent(experience)),
              ]
            : []),

          ...(salaryWorkExperiences.length > 0
            ? [
                await createParagraphWithImageAndText(
                  ReportContent.SALARY_WORK_TITLE,
                  ReportContent.IMAGE_URLS.DOLLAR_BAG_ICON
                ),
                ...salaryWorkExperiences.flatMap((experience) => generateContent(experience)),
              ]
            : []),

          ...(unpaidWorkExperiences.length > 0
            ? [
                await createParagraphWithImageAndText(
                  ReportContent.UNPAID_WORK_TITLE,
                  ReportContent.IMAGE_URLS.FRIENDLY_ICON
                ),
                ...unpaidWorkExperiences.flatMap((experience) => generateContent(experience)),
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
