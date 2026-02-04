export type LogoItem = {
  url: string;
  docxStyles: {
    width: number;
    height: number;
  };
  pdfStyles: Record<string, any>;
};

export enum DownloadFormat {
  PDF = "PDF",
  DOCX = "DOCX",
}

export type ReportConfig = {
  summary: {
    show: boolean;
  };
  experienceDetails: {
    title: boolean;
    summary: boolean;
    location: boolean;
    dateRange: boolean;
    companyName: boolean;
  };
};

export type SkillsReportOutputConfig = {
  logos: LogoItem[];
  downloadFormats: DownloadFormat[];
  report: ReportConfig;
};
