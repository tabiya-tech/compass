import { PDFReportDownloadProvider } from "src/Report/ReactPdf/provider";
import { DocxReportDownloadProvider } from "src/Report/ReportDocx/provider";
import { ExportFormat, IReportFormatProvider, ReportProps } from "./types";

export class ReportFormatProvider {
  props: ReportProps;

  constructor(props: ReportProps) {
    this.props = props;
  }

  static init(props: ReportProps, format: ExportFormat): IReportFormatProvider {
    if (format === ExportFormat.PDF) {
      return new PDFReportDownloadProvider(props);
    } else if (format === ExportFormat.DOCX) {
      return new DocxReportDownloadProvider(props);
    } else {
      throw new Error("Unsupported format");
    }
  }
}
