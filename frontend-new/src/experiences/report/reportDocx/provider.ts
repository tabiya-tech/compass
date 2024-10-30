import ReportDocx from "src/experiences/report/reportDocx/ReportDocx";
import { IReportFormatProvider, ReportProps } from "src/experiences/report/types";

export class DocxReportDownloadProvider implements IReportFormatProvider {
  props: ReportProps;

  constructor(props: ReportProps) {
    this.props = props;
  }

  async download() {
    await ReportDocx({
      name: this.props.name,
      email: this.props.email,
      phone: this.props.phone,
      address: this.props.address,
      experiences: this.props.experiences,
      conversationConductedAt: this.props.conversationConductedAt,
    });
  }
}
