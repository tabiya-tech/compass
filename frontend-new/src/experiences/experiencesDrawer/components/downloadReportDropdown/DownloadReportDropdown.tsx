import React from "react";
import { Experience } from "src/experiences/experiencesDrawer/experienceService/experiences.types";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import DownloadReportButton from "src/experiences/experiencesDrawer/components/downloadReportButton/DownloadReportButton";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { PDFReportDownloadProvider } from "src/experiences/report/reportPdf/provider";
import { DocxReportDownloadProvider } from "src/experiences/report/reportDocx/provider";

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
  PDF: `${uniqueId}-pdf`,
  DOCX: `${uniqueId}-docx`,
};

export const MENU_ITEM_TEXT = {
  PDF: "PDF",
  DOCX: "DOCX",
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

  const docxsReportProvider = new DocxReportDownloadProvider();
  const pdfReportProvider = new PDFReportDownloadProvider();

  const contextMenuItems: MenuItemConfig[] = [
    {
      id: MENU_ITEM_ID.PDF,
      text: MENU_ITEM_TEXT.PDF,
      disabled: false,
      action: () => pdfReportProvider.download(reportProps),
    },
    {
      id: MENU_ITEM_ID.DOCX,
      text: MENU_ITEM_TEXT.DOCX,
      disabled: false,
      action: () => docxsReportProvider.download(reportProps),
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
