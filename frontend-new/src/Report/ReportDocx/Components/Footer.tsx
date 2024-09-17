import { ReportContent } from "src/Report/ReportContent";
import { Footer, Paragraph, ImageRun, AlignmentType, TextRun, PageNumber, BorderStyle } from "docx";
import { getBase64Image } from "src/Report/util";

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
            color: "#666666",
          }),
          new TextRun({
            text: ReportContent.DISCLAIMER_TEXT_PART2,
            size: 18,
            color: "#000000",
          }),
          new TextRun({
            text: ReportContent.DISCLAIMER_TEXT_PART3,
            size: 18,
            color: "#666666",
          }),
        ],
        alignment: AlignmentType.LEFT,
        border: {
          top: { style: BorderStyle.SINGLE, size: 2, color: "#666666", space: 5 },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: "#666666", space: 10 },
          left: { style: BorderStyle.SINGLE, size: 2, color: "#666666", space: 10 },
          right: { style: BorderStyle.SINGLE, size: 2, color: "#666666", space: 5 },
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
