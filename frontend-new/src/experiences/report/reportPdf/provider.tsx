import React from "react";
import SkillReportPDF from "src/experiences/report/reportPdf/SkillReportPDF";
import { IReportFormatProvider, ReportProps } from "src/experiences/report/types";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "src/experiences/saveAs";
import { SkillsReportOutputConfig } from "src/experiences/report/config/types";

export class PDFReportDownloadProvider implements IReportFormatProvider {
  constructor(private config: SkillsReportOutputConfig) {}

  async download(props: ReportProps) {
    try {
      const fileName = "compass-cv.pdf";
      const report = pdf(
        <SkillReportPDF
          name={props.name}
          email={props.email}
          phone={props.phone}
          address={props.address}
          experiences={props.experiences}
          conversationConductedAt={props.conversationConductedAt}
          config={this.config}
        />
      );
      // noinspection JSVoidFunctionReturnValueUsed Intellij is wrong here, this is a promise
      const blob = await report.toBlob();
      saveAs(blob, fileName);
    } catch (error) {
      console.error("Failed to download report", error);
    }
  }
}
