import { DownloadFormat, SkillsReportOutputConfig } from "./types";
import { ReportContent } from "src/experiences/report/reportContent";

export const defaultSkillsReportOutputConfig: SkillsReportOutputConfig = {
  logos: [
    {
      url: ReportContent.IMAGE_URLS.COMPASS_LOGO,
      docxStyles: {
        width: 250,
        height: 62,
      },
      pdfStyles: {
        height: 46,
      },
    },
    {
      url: ReportContent.IMAGE_URLS.OXFORD_LOGO,
      docxStyles: {
        width: 200,
        height: 58,
      },
      pdfStyles: {
        height: 42,
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
