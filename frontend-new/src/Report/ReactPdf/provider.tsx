import React from "react";
import SkillReport from "src/Report/ReactPdf/Report";
import { IReportFormatProvider, ReportProps } from "src/Report/types";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";

export class PDFReportDownloadProvider implements IReportFormatProvider {
  props: ReportProps;

  constructor(props: ReportProps) {
    this.props = props;
  }

  async download() {
    const fileName = "compass-skills-report.pdf";
    const blob = await pdf(
      <SkillReport
        name={this.props.name}
        email={this.props.email}
        phone={this.props.phone}
        address={this.props.address}
        experiences={this.props.experiences}
        conversationCompletedAt={this.props.conversationCompletedAt}
      />
    ).toBlob();
    saveAs(blob, fileName);
  }
}
