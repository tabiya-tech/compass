import React, { useContext, useState } from "react";
import { Experience } from "src/experiences/experienceService/experiences.types";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import DownloadReportButton from "src/experiences/experiencesDrawer/components/downloadReportButton/DownloadReportButton";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { PDFReportDownloadProvider } from "src/experiences/report/reportPdf/provider";
import { DocxReportDownloadProvider } from "src/experiences/report/reportDocx/provider";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { ReportProps } from "src/experiences/report/types";

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
  const isOnline = useContext(IsOnlineContext);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleDownload = async (downloadProvider: { download: (props: ReportProps) => Promise<void> }) => {
    setIsLoading(true);
    try {
      await downloadProvider.download(reportProps);
    } catch (error) {
      console.error("Error downloading report", error);
    } finally {
      setIsLoading(false);
    }
  };

  const contextMenuItems: MenuItemConfig[] = [
    {
      id: MENU_ITEM_ID.PDF,
      text: MENU_ITEM_TEXT.PDF,
      disabled: !isOnline,
      action: () => handleDownload(pdfReportProvider),
    },
    {
      id: MENU_ITEM_ID.DOCX,
      text: MENU_ITEM_TEXT.DOCX,
      disabled: !isOnline,
      action: () => handleDownload(docxsReportProvider),
    },
  ];

  return (
    <>
      <DownloadReportButton
        notifyOnDownloadPdf={(event) => setAnchorEl(event.currentTarget)}
        disabled={props.disabled}
        isLoading={isLoading}
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
