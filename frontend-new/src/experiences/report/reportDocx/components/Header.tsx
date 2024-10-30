import { AlignmentType, Header, ImageRun, Paragraph, TextRun } from "docx";
import { getBase64Image } from "src/experiences/report/util";
import { ReportContent } from "src/experiences/report/reportContent";

const HeaderComponent = async () => {
  return new Header({
    children: [
      new Paragraph({
        children: [
          new ImageRun({
            data: await getBase64Image(ReportContent.IMAGE_URLS.COMPASS_LOGO),
            transformation: { width: 250, height: 62 },
          }),
          new TextRun({
            text: "\u00A0\u00A0\u00A0\u00A0\u00A0",
          }),
          new ImageRun({
            data: await getBase64Image(ReportContent.IMAGE_URLS.OXFORD_LOGO),
            transformation: { width: 200, height: 58 },
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 300 },
      }),
    ],
  });
};

export default HeaderComponent;
