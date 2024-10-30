import { Experience } from "src/experiences/experiencesDrawer/experienceService/experiences.types";

export type ReportProps = {
  name: string;
  email: string;
  phone: string;
  address: string;
  experiences: Experience[];
  conversationConductedAt: string | null;
};

export enum ExportFormat {
  PDF = "pdf",
  DOCX = "docx",
}

export interface IReportFormatProvider {
  download: () => void;
}
