import { AlignmentType, Header, ImageRun, Paragraph, TextRun } from "docx";
import { getBase64Image } from "src/Report/util";
import { ReportContent } from "src/Report/ReportContent";

const HeaderComponent = async () => {
  return new Header({
    children: [
      new Paragraph({
        children: [
          new ImageRun({
            data: await getBase64Image(ReportContent.IMAGE_URLS.COMPASS_LOGO),
            transformation: { width: 180, height: 60 },
          }),
          new TextRun({
            text: "\u00A0\u00A0\u00A0\u00A0\u00A0",
          }),
          new ImageRun({
            data: await getBase64Image(ReportContent.IMAGE_URLS.OXFORD_LOGO),
            transformation: { width: 180, height: 52 },
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 300 },
      }),
    ],
  });
};

export default HeaderComponent;
