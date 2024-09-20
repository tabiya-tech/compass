import { ReportContent } from "src/Report/ReportContent";
import { Footer, Paragraph, ImageRun, AlignmentType, TextRun, PageNumber, BorderStyle } from "docx";
import { COLORS, getBase64Image } from "src/Report/util";
import { TabiyaBasicColors } from "src/theme/applicationTheme/applicationTheme";

const FooterComponent = async () => {
  return new Footer({
    children: [
      new Paragraph({
        spacing: { before: 400 },
      }),
      new Paragraph({
        children: [
          new ImageRun({
            data: await getBase64Image(ReportContent.IMAGE_URLS.DANGER_ICON),
            transformation: { width: 16, height: 14 },
          }),
          new TextRun({
            text: " ",
          }),
          new TextRun({
            text: ReportContent.DISCLAIMER_TEXT_PART1,
            size: 18,
            color: COLORS.grey700,
          }),
          new TextRun({
            text: ReportContent.DISCLAIMER_TEXT_PART2,
            size: 18,
            color: COLORS.textBlack,
          }),
          new TextRun({
            text: ReportContent.DISCLAIMER_TEXT_PART3,
            size: 18,
            color: COLORS.grey700,
          }),
        ],
        alignment: AlignmentType.LEFT,
        border: {
          top: { style: BorderStyle.SINGLE, size: 2, color: TabiyaBasicColors.GrayDark, space: 5 },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: TabiyaBasicColors.GrayDark, space: 10 },
          left: { style: BorderStyle.SINGLE, size: 2, color: TabiyaBasicColors.GrayDark, space: 10 },
          right: { style: BorderStyle.SINGLE, size: 2, color: TabiyaBasicColors.GrayDark, space: 5 },
        },
      }),
      new Paragraph({
        children: [
          new TextRun({
            children: [PageNumber.CURRENT, "/", PageNumber.TOTAL_PAGES],
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 300 },
      }),
    ],
  });
};

export default FooterComponent;
