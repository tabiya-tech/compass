import React from "react";
import SkillReportPDF from "src/experiences/report/reportPdf/SkillReportPDF";
import { IReportFormatProvider, ReportProps } from "src/experiences/report/types";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "src/experiences/saveAs";
import { SkillsReportOutputConfig } from "src/experiences/report/config/types";
import { getProductName } from "src/envService";

export const PDF_REPORT_FILENAME = "Experience-Report.pdf";
export const PDF_MIME_TYPE = "application/pdf";

export class PDFReportDownloadProvider implements IReportFormatProvider {
  constructor(private config: SkillsReportOutputConfig) {}

  /**
   * Generates a PDF blob from the report props.
   * Returns the blob with MIME type "application/pdf".
   */
  async generateBlob(props: ReportProps): Promise<Blob> {
    const report = pdf(
      <SkillReportPDF
        name={props.name}
        email={props.email}
        location={props.location}
        school={props.school}
        program={props.program}
        experiences={props.experiences}
        conversationConductedAt={props.conversationConductedAt}
        config={this.config}
      />
    );
    // noinspection JSVoidFunctionReturnValueUsed Intellij is wrong here, this is a promise
    const blob = await report.toBlob();
    return blob;
  }

  async download(props: ReportProps) {
    try {
      const fileName = `${getProductName().toLowerCase()}-cv.pdf`;
      const blob = await this.generateBlob(props);
      saveAs(blob, fileName);
    } catch (error) {
      console.error("Failed to download report", error);
    }
  }
}
