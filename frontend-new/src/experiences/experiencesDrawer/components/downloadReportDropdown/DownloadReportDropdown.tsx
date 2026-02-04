import React, { useContext, useState } from "react";
import { Experience } from "src/experiences/experienceService/experiences.types";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import DownloadReportButton from "src/experiences/experiencesDrawer/components/downloadReportButton/DownloadReportButton";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { PDFReportDownloadProvider } from "src/experiences/report/reportPdf/provider";
import { DocxReportDownloadProvider } from "src/experiences/report/reportDocx/provider";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { ReportProps } from "src/experiences/report/types";
import MetricsService from "src/metrics/metricsService";
import { EventType } from "src/metrics/types";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import { MetricsError } from "src/error/commonErrors";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { DownloadFormat, SkillsReportOutputConfig } from "src/experiences/report/config/types";
import { getSkillsReportOutputConfig } from "src/experiences/report/config/getConfig";

interface DownloadReportDropdownProps {
  name: string;
  email: string;
  phone: string;
  address: string;
  experiences: Experience[];
  conversationConductedAt: string | null;
  disabled?: boolean;
  outputConfig?: SkillsReportOutputConfig;
}

export enum CVFormat {
  PDF = "PDF",
  DOCX = "DOCX",
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
    // if the conversation conducted at is somehow null, use the current date
    conversationConductedAt: props.conversationConductedAt ?? new Date().toISOString(),
  };

  const outputConfig = props.outputConfig ?? getSkillsReportOutputConfig();
  const docxsReportProvider = new DocxReportDownloadProvider(outputConfig);
  const pdfReportProvider = new PDFReportDownloadProvider(outputConfig);

  const handleDownload = async (
    downloadProvider: { download: (props: ReportProps) => Promise<void> },
    downloadFormat: CVFormat
  ) => {
    setIsLoading(true);
    try {
      await downloadProvider.download(reportProps);
    } catch (error) {
      console.error("Error downloading report", error);
    } finally {
      setIsLoading(false);
      const user_id = AuthenticationStateService.getInstance().getUser()?.id;
      const session_id = UserPreferencesStateService.getInstance().getActiveSessionId();

      if (user_id && session_id) {
        MetricsService.getInstance().sendMetricsEvent({
          event_type: EventType.CV_DOWNLOADED,
          cv_format: downloadFormat,
          // the user id is required for the metrics event but is possibly null
          user_id: user_id,
          session_id: session_id,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.error(
          new MetricsError(`Unable to send CVDownload metrics: User id: ${user_id}, Session id: ${session_id}`)
        );
      }
    }
  };

  // Define all available menu items
  const allMenuItems: Record<DownloadFormat, MenuItemConfig> = {
    [DownloadFormat.PDF]: {
      id: MENU_ITEM_ID.PDF,
      text: MENU_ITEM_TEXT.PDF,
      disabled: !isOnline,
      action: () => handleDownload(pdfReportProvider, CVFormat.PDF),
    },
    [DownloadFormat.DOCX]: {
      id: MENU_ITEM_ID.DOCX,
      text: MENU_ITEM_TEXT.DOCX,
      disabled: !isOnline,
      action: () => handleDownload(docxsReportProvider, CVFormat.DOCX),
    },
  };

  // Filter and order menu items based on config
  const contextMenuItems: MenuItemConfig[] = outputConfig.downloadFormats
    .map((format) => allMenuItems[format])
    .filter((item): item is MenuItemConfig => Boolean(item));

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
