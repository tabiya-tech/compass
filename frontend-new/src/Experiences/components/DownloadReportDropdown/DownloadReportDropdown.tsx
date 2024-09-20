import React from "react";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import DownloadReportButton from "src/Experiences/components/DownloadReportButton/DownloadReportButton";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { ExportFormat } from "src/Report/types";
import { ReportFormatProvider } from "src/Report/ReportProvider";

interface DownloadReportDropdownProps {
  name: string;
  email: string;
  phone: string;
  address: string;
  experiences: Experience[];
  conversationConductedAt: string;
  disabled?: boolean;
}

const uniqueId = "05c29b7a-ebf7-4795-ba23-a284aecad180";

export const MENU_ITEM_ID = {
  REPORT_PDF: `${uniqueId}-report-pdf`,
  REPORT_DOCX: `${uniqueId}-report-docx`,
};

export const MENU_ITEM_TEXT = {
  REPORT_PDF: "Report PDF",
  REPORT_DOCX: "Report DOCX",
};

const DownloadReportDropdown: React.FC<DownloadReportDropdownProps> = (props) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const reportProps = {
    name: props.name,
    email: props.email,
    phone: props.phone,
    address: props.address,
    experiences: props.experiences,
    conversationConductedAt: props.conversationConductedAt,
  };

  const docsReportProvider = ReportFormatProvider.init(reportProps, ExportFormat.DOCX);
  const pdfReportProvider = ReportFormatProvider.init(reportProps, ExportFormat.PDF);

  const contextMenuItems: MenuItemConfig[] = [
    {
      id: MENU_ITEM_ID.REPORT_PDF,
      text: MENU_ITEM_TEXT.REPORT_PDF,
      disabled: false,
      action: () => pdfReportProvider.download(),
    },
    {
      id: MENU_ITEM_ID.REPORT_DOCX,
      text: MENU_ITEM_TEXT.REPORT_DOCX,
      disabled: false,
      action: () => docsReportProvider.download(),
    },
  ];

  return (
    <>
      <DownloadReportButton
        notifyOnDownloadPdf={(event) => setAnchorEl(event.currentTarget)}
        disabled={props.disabled}
      />
      <ContextMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        notifyOnClose={() => setAnchorEl(null)}
        items={contextMenuItems}
      />
    </>
  );
};

export default DownloadReportDropdown;
