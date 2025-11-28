import { Footer, Paragraph, AlignmentType, TextRun, PageNumber } from "docx";

const FooterComponent = () => {
  return new Footer({
    children: [
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
