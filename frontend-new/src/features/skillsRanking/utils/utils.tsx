import { Theme } from "@mui/material/styles";

interface StyleParams {
  index: number;
  selectedIndex: number | null;
  hoveredIndex: number | null;
  disabled: boolean;
}

export const getBackgroundColor = ({ index, selectedIndex, hoveredIndex }: StyleParams, theme: Theme): string => {
  if (selectedIndex !== null) {
    if (index === selectedIndex) return theme.palette.primary.dark;
    if (index < selectedIndex) return theme.palette.primary.light;
    return "transparent";
  }
  if (hoveredIndex !== null && index <= hoveredIndex) {
    return theme.palette.primary.light;
  }
  return "transparent";
};

export const getBorderStyle = ({ index, selectedIndex, hoveredIndex, disabled }: StyleParams, theme: Theme): string => {
  if (disabled && selectedIndex !== null && index <= selectedIndex) {
    return "none";
  }
  if (disabled) {
    return `2px solid ${theme.palette.grey[500]}`;
  }
  if (hoveredIndex !== null && index <= hoveredIndex) {
    return "none";
  }
  if (selectedIndex !== null && index <= selectedIndex) {
    return "none";
  }
  return `2px solid ${theme.palette.primary.dark}`;
};

export const getDividerColor = (
  { index, selectedIndex, hoveredIndex, disabled }: StyleParams,
  theme: Theme
): string => {
  if (selectedIndex !== null && index < selectedIndex) {
    return theme.palette.primary.light;
  }
  if (disabled && (selectedIndex === null || index >= selectedIndex)) {
    return theme.palette.grey[500];
  }
  if (hoveredIndex !== null && index <= hoveredIndex) {
    return theme.palette.primary.light;
  }
  return theme.palette.primary.dark;
};