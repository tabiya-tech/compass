import React from "react";
import { Slider, styled } from "@mui/material";

export interface SkillsRankingSliderProps {
  value: number;
  onChange: (event: Event, value: number | number[]) => void;
  disabled?: boolean;
  marks?: Array<{ value: number; label: string }>;
  "data-testid"?: string;
  "aria-label"?: string;
}

export const StyledSlider = styled(Slider)(({ theme, disabled = false }) => ({
  height: theme.fixedSpacing(theme.tabiyaSpacing.md),
  "& .MuiSlider-track": {
    backgroundColor: theme.palette.primary.main,
    opacity: disabled ? 0.5 : 1,
    borderRadius: theme.rounding(theme.tabiyaRounding.xs),
  },
  "& .MuiSlider-rail": {
    backgroundColor: theme.palette.common.white,
    border: `1px solid ${theme.palette.grey[300]}`,
    borderRadius: theme.rounding(theme.tabiyaRounding.xs),
  },
  "& .MuiSlider-thumb": {
    boxShadow: "none",
    border: disabled ? `1px solid ${theme.palette.grey[200]}` : "none",
    borderRadius: theme.rounding(theme.tabiyaRounding.xs),
    width: theme.fixedSpacing(theme.tabiyaSpacing.lg),
    height: theme.fixedSpacing(theme.tabiyaSpacing.lg),
    backgroundColor: disabled ? theme.palette.secondary.light : theme.palette.primary.dark,
  },
  "& .MuiSlider-valueLabel": {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.common.black,
    fontWeight: "bold",
    fontSize: theme.typography.caption.fontSize,
    borderRadius: theme.fixedSpacing(theme.tabiyaSpacing.sm),
    top: 60,
    opacity: disabled ? 0.7 : 1,
    "&::before": {
      top: "-8px",
      borderTopColor: theme.palette.primary.main,
      borderBottomColor: "transparent",
    },
  },
  "& .MuiSlider-mark": {
    display: "none",
  },
  "& .MuiSlider-markLabel": {
    fontSize: "0.75rem",
    opacity: disabled ? 0.5 : 1,
  },
  "& .MuiSlider-markLabel[data-index='0']": {
    transform: "translateX(0%)",
  },
  "& .MuiSlider-markLabel[data-index='1']": {
    transform: "translateX(-100%)",
  },
}));

const SkillsRankingSlider: React.FC<SkillsRankingSliderProps> = ({
  value,
  onChange,
  disabled = false,
  marks = [
    { value: 0, label: "0%" },
    { value: 100, label: "100%" },
  ],
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
}) => {
  return (
    <StyledSlider
      value={value}
      onChange={onChange}
      disabled={disabled}
      min={0}
      max={100}
      step={1}
      valueLabelDisplay={value === 0 ? "off" : "on"}
      valueLabelFormat={(value) => `${value}%`}
      marks={marks}
      data-testid={dataTestId}
      aria-label={ariaLabel}
    />
  );
};

export default SkillsRankingSlider;
