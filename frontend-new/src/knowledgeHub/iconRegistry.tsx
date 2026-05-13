import React from "react";
import WorkIcon from "@mui/icons-material/Work";
import AgricultureIcon from "@mui/icons-material/Agriculture";
import BoltIcon from "@mui/icons-material/Bolt";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import WaterIcon from "@mui/icons-material/Water";
import LocalHospitalIcon from "@mui/icons-material/LocalHospital";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";

// Icon registry - maps icon names to MUI icon components
export const ICON_REGISTRY: Record<string, React.ReactNode> = {
  Mining: <WorkIcon sx={{ fontSize: 40 }} />,
  Agriculture: <AgricultureIcon sx={{ fontSize: 40 }} />,
  Energy: <BoltIcon sx={{ fontSize: 40 }} />,
  Hospitality: <RestaurantIcon sx={{ fontSize: 40 }} />,
  Water: <WaterIcon sx={{ fontSize: 40 }} />,
  Health: <LocalHospitalIcon sx={{ fontSize: 40 }} />,
};

// Default icon to use when no icon is specified or found in registry
export const DEFAULT_ICON = <ArticleOutlinedIcon sx={{ fontSize: 40 }} />;

// Get icon for a document - returns the icon from registry or default
export const getDocumentIcon = (iconName?: string): React.ReactNode => {
  if (!iconName) {
    return DEFAULT_ICON;
  }
  return ICON_REGISTRY[iconName] || DEFAULT_ICON;
};
