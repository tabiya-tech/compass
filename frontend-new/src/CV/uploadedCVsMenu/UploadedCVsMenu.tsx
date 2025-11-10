import React from "react";
import { Box, Typography, Skeleton, useTheme, CircularProgress } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import InfoIcon from "@mui/icons-material/Info";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import HelpTip from "src/theme/HelpTip/HelpTip";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import { CVListItem } from "src/CV/CVService/CVService.types";
import { ConversationPhase } from "src/chat/chatProgressbar/types";
import { getDurationFromNow } from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/getDurationFromNow/getDurationFromNow";

const uniqueId = "e9b40dcc-8068-45ec-a96a-9feb823f1696";

export const DATA_TEST_ID = {
  UPLOADED_CVS_MENU_CONTENT: `uploaded-cvs-menu-content-${uniqueId}`,
  UPLOADED_CVS_MENU_ARROW_BACK_ICON: `uploaded-cvs-menu-arrow-back-icon-${uniqueId}`,
  UPLOADED_CVS_MENU_HELP_TIP: `uploaded-cvs-menu-help-tip-${uniqueId}`,
  UPLOADED_CVS_MENU_UPLOADED_TEXT: `uploaded-cvs-menu-uploaded-text-${uniqueId}`,
  UPLOADED_CVS_MENU_DESCRIPTION_ICON: `uploaded-cvs-menu-description-icon-${uniqueId}`,
  UPLOADED_CVS_MENU_FILE_NAME: `uploaded-cvs-menu-file-name-${uniqueId}`,
  UPLOADED_CVS_MENU_UPLOAD_DATE: `uploaded-cvs-menu-upload-date-${uniqueId}`,
  UPLOADED_CVS_MENU_SKELETON: `uploaded-cvs-menu-skeleton-${uniqueId}`,
  UPLOADED_CVS_MENU_PROGRESS: `uploaded-cvs-menu-progress-${uniqueId}`,
};

interface UploadedCVsMenuContentProps {
  uploadedCVs: CVListItem[];
  onSelect: (cv: CVListItem) => void;
  onBack: () => void;
  isLoading: boolean;
  currentPhase?: ConversationPhase;
  isReinjecting?: boolean;
}

const UploadedCVsMenu: React.FC<UploadedCVsMenuContentProps> = ({
  currentPhase,
  onBack,
  onSelect,
  uploadedCVs,
  isLoading,
  isReinjecting = false,
}) => {
  const theme = useTheme();
  const helpTipText = "Select a CV to inject its experiences into this conversation.";

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", width: "100%", gap: theme.fixedSpacing(theme.tabiyaSpacing.md) }}
      data-testid={DATA_TEST_ID.UPLOADED_CVS_MENU_CONTENT}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: theme.fixedSpacing(theme.tabiyaSpacing.xs),
          px: theme.fixedSpacing(theme.tabiyaSpacing.md),
        }}
      >
        <PrimaryIconButton
          title="Back to main menu"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBack();
          }}
          sx={{ color: theme.palette.text.secondary }}
          data-testid={DATA_TEST_ID.UPLOADED_CVS_MENU_ARROW_BACK_ICON}
        >
          <ArrowBackIcon />
        </PrimaryIconButton>
        <Typography
          variant="subtitle2"
          fontWeight="bold"
          color="text.primary"
          data-testid={DATA_TEST_ID.UPLOADED_CVS_MENU_UPLOADED_TEXT}
        >
          {`Previously uploaded CVs (${uploadedCVs.length})`}
        </Typography>
        <HelpTip icon={<InfoIcon />} data-testid={DATA_TEST_ID.UPLOADED_CVS_MENU_HELP_TIP}>
          {helpTipText}
        </HelpTip>
        {isReinjecting && (
          <CircularProgress
            size={16}
            thickness={6}
            sx={{ color: theme.palette.text.secondary }}
            data-testid={DATA_TEST_ID.UPLOADED_CVS_MENU_PROGRESS}
          />
        )}
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          rowGap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
          maxHeight: theme.fixedSpacing(theme.tabiyaSpacing.xl * 6),
          overflow: "auto",
          px: theme.fixedSpacing(theme.tabiyaSpacing.md),
        }}
      >
        {isLoading && (
          <Box sx={{ display: "flex", flexDirection: "column" }} data-testid={DATA_TEST_ID.UPLOADED_CVS_MENU_SKELETON}>
            {Array.from({ length: 2 }).map((_, idx) => (
              <Box
                key={idx}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  py: theme.fixedSpacing(theme.tabiyaSpacing.xs),
                  gap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                }}
              >
                <Skeleton variant="circular" width={24} height={24} />
                <Box sx={{ flexGrow: 1 }}>
                  <Skeleton variant="text" width="100%" />
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {!isLoading && uploadedCVs.length === 0 && (
          <Typography variant="caption" color="secondary">
            No uploaded CVs found.
          </Typography>
        )}

        {!isLoading &&
          uploadedCVs.map((cv) => {
            const disabled = isReinjecting;
            return (
              <Box
                key={cv.upload_id}
                onClick={() => {
                  if (disabled) return;
                  onSelect(cv);
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  columnGap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
                  "&:hover": {
                    backgroundColor: disabled ? "transparent" : theme.palette.action.hover,
                    cursor: disabled ? "default" : "pointer",
                  },
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <DescriptionOutlinedIcon
                  sx={{ color: theme.palette.text.secondary }}
                  data-testid={DATA_TEST_ID.UPLOADED_CVS_MENU_DESCRIPTION_ICON}
                />
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Typography
                    variant="caption"
                    color="secondary"
                    data-testid={DATA_TEST_ID.UPLOADED_CVS_MENU_FILE_NAME}
                  >
                    {cv.filename}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontSize: theme.fixedSpacing(theme.tabiyaSpacing.sm * 1.3) }}
                    data-testid={DATA_TEST_ID.UPLOADED_CVS_MENU_UPLOAD_DATE}
                  >
                    {getDurationFromNow(new Date(cv.uploaded_at))}
                  </Typography>
                </Box>
              </Box>
            );
          })}
      </Box>
    </Box>
  );
};

export default UploadedCVsMenu;
