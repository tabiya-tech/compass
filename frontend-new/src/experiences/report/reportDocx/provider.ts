import SkillReportDocx from "src/experiences/report/reportDocx/SkillReportDocx";
import { IReportFormatProvider, ReportProps } from "src/experiences/report/types";
import { saveAs } from "src/experiences/saveAs";

export class DocxReportDownloadProvider implements IReportFormatProvider {
  async download(props: ReportProps) {
    try {
      const fileName = "compass-skills-report.docx";
      const blob = await SkillReportDocx({
        name: props.name,
        email: props.email,
        phone: props.phone,
        address: props.address,
        experiences: props.experiences,
        conversationConductedAt: props.conversationConductedAt,
      });
      saveAs(blob, fileName);
    } catch (error) {
      console.error("Failed to download report", error);
    }
  }
}
