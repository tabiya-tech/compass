import React, { useContext } from "react";
import { Box, useTheme } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";

const uniqueId = "e4f5a6b7-c8d9-0123-efab-456789012345";

export const DATA_TEST_ID = {
  VIEW_CV_CARD_BUTTON: `home-sidebar-view-cv-button-${uniqueId}`,
};

interface ViewCVCardProps {
  onClick: () => void;
}

const ViewCVCard: React.FC<ViewCVCardProps> = ({ onClick }) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);

  const handleClick = () => {
    if (!isOnline) return;
    onClick();
  };

  return (
    <Box
      component="button"
      data-testid={DATA_TEST_ID.VIEW_CV_CARD_BUTTON}
      onClick={handleClick}
      disabled={!isOnline}
      aria-disabled={!isOnline}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: theme.fixedSpacing(theme.tabiyaSpacing.sm * 1.5),
        width: 300,
        padding: theme.fixedSpacing(theme.tabiyaSpacing.sm * 1.5),
        borderRadius: theme.rounding(theme.tabiyaRounding.sm * 1.25),
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        cursor: isOnline ? "pointer" : "default",
        opacity: isOnline ? 1 : 0.6,
        textAlign: "left",
        "&:hover:not(:disabled)": { backgroundColor: theme.palette.action.hover },
      }}
    >
      <Box
        sx={{
          width: theme.fixedSpacing(theme.tabiyaSpacing.xl * 1.25),
          height: theme.fixedSpacing(theme.tabiyaSpacing.xl * 1.25),
          borderRadius: theme.rounding(theme.tabiyaRounding.sm),
          backgroundColor: theme.palette.secondary.main,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            ...theme.typography.body2,
            fontWeight: 700,
            color: theme.palette.secondary.main,
            lineHeight: 1.3,
          }}
        >
          View My CV
        </Box>
        <Box
          sx={{
            ...theme.typography.caption,
            color: theme.palette.text.secondary,
            lineHeight: 1.4,
            marginTop: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
          }}
        >
          Download and share your personalized CV
        </Box>
      </Box>
      <ChevronRightIcon sx={{ color: theme.palette.text.secondary, fontSize: "18px", flexShrink: 0 }} />
    </Box>
  );
};

export default ViewCVCard;
