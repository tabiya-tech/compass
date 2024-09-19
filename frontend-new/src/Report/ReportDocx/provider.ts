import ReportDocx from "src/Report/ReportDocx/ReportDocx";
import { IReportFormatProvider, ReportProps } from "src/Report/types";

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
