import { AlignmentType, Header, ImageRun, Paragraph, TextRun } from "docx";
import { getBase64Image } from "src/experiences/report/util";
import { ReportContent } from "src/experiences/report/reportContent";

const LOGO_SPACER = "\u00A0\u00A0\u00A0";

const LOGO_CONFIG = [
  { imageUrl: ReportContent.IMAGE_URLS.COMPASS_LOGO, width: 132, height: 32 },
  { imageUrl: ReportContent.IMAGE_URLS.OXFORD_LOGO, width: 110, height: 32 },
  { imageUrl: ReportContent.IMAGE_URLS.YOUTH_INNOVATION_FUND_LOGO, width: 95, height: 32 },
  { imageUrl: ReportContent.IMAGE_URLS.EMPUJAR_LOGO, width: 96, height: 32 },
  { imageUrl: ReportContent.IMAGE_URLS.PLACEHOLDER_LOGO, width: 133, height: 40 },
];

const HeaderComponent = async () => {
  const logoRuns: Array<ImageRun | TextRun> = [];

  for (const [index, logo] of LOGO_CONFIG.entries()) {
    logoRuns.push(
      new ImageRun({
        data: await getBase64Image(logo.imageUrl),
        transformation: { width: logo.width, height: logo.height },
      })
    );

    if (index < LOGO_CONFIG.length - 1) {
      logoRuns.push(
        new TextRun({
          text: LOGO_SPACER,
        })
      );
    }
  }

  return new Header({
    children: [
      new Paragraph({
        children: logoRuns,
        alignment: AlignmentType.LEFT,
        spacing: { after: 300 },
      }),
    ],
  });
};

export default HeaderComponent;
