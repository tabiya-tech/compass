import React from "react";
import SkillReportPDF from "src/experiences/report/reportPdf/SkillReportPDF";
import { IReportFormatProvider, ReportProps } from "src/experiences/report/types";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "src/experiences/saveAs";

export class PDFReportDownloadProvider implements IReportFormatProvider {
  async download(props: ReportProps) {
    const fileName = "compass-skills-report.pdf";
    const blob = await pdf(
      <SkillReportPDF
        name={props.name}
        email={props.email}
        phone={props.phone}
        address={props.address}
        experiences={props.experiences}
        conversationConductedAt={props.conversationConductedAt}
      />
    ).toBlob();
    saveAs(blob, fileName);
  }
}
