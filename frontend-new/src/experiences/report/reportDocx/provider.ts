import SkillReportDocx from "src/experiences/report/reportDocx/SkillReportDocx";
import { IReportFormatProvider, ReportProps } from "src/experiences/report/types";
import { saveAs } from "src/experiences/saveAs";
import { SkillsReportOutputConfig } from "src/experiences/report/config/types";

export class DocxReportDownloadProvider implements IReportFormatProvider {
  constructor(private config: SkillsReportOutputConfig) {}

  async download(props: ReportProps) {
    try {
      const fileName = "compass-cv.docx";
      const blob = await SkillReportDocx({
        name: props.name,
        email: props.email,
        phone: props.phone,
        address: props.address,
        experiences: props.experiences,
        conversationConductedAt: props.conversationConductedAt,
        config: this.config,
      });
      saveAs(blob, fileName);
    } catch (error) {
      console.error("Failed to download report", error);
    }
  }
}
