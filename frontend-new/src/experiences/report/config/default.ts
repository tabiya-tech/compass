import { DownloadFormat, SkillsReportOutputConfig } from "./types";
import { ReportContent } from "src/experiences/report/reportContent";

export const defaultSkillsReportOutputConfig: SkillsReportOutputConfig = {
  logos: [
    {
      url: ReportContent.IMAGE_URLS.NJILA_LOGO,
      docxStyles: {
        width: 120,
        height: 62,
      },
      pdfStyles: {
        height: 46,
      },
    },
  ],
  downloadFormats: [DownloadFormat.DOCX, DownloadFormat.PDF],
  report: {
    summary: {
      show: true,
    },
    experienceDetails: {
      title: true,
      summary: true,
      location: true,
      dateRange: true,
      companyName: true,
    },
  },
};
