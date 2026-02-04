import { AlignmentType, Header, ImageRun, Paragraph, TextRun } from "docx";
import { getBase64Image } from "src/experiences/report/util";
import { LogoItem } from "src/experiences/report/config/types";

const HeaderComponent = async (logos: LogoItem[]) => {
  // If no logos, return header with no children
  if (logos.length === 0) {
    return new Header({
      children: [],
    });
  }

  // Build logo runs with spacing between them
  const children: (ImageRun | TextRun)[] = [];
  for (let i = 0; i < logos.length; i++) {
    const logo = logos[i];
    children.push(
      new ImageRun({
        data: await getBase64Image(logo.url),
        transformation: logo.docxStyles,
      })
    );
    // Add spacing between logos (but not after the last one)
    if (i < logos.length - 1) {
      children.push(
        new TextRun({
          text: "\u00A0\u00A0\u00A0\u00A0\u00A0",
        })
      );
    }
  }

  return new Header({
    children: [
      new Paragraph({
        children,
        alignment: AlignmentType.LEFT,
        spacing: { after: 300 },
      }),
    ],
  });
};

export default HeaderComponent;
