import React from "react";
import { Box, Stack, Typography, useTheme } from "@mui/material";
import { StyledSlider } from "./SkillsRankingSlider";

export interface MultiValue {
  value: number;
  label: string;
  color: string;
}

export interface SkillsRankingMultiThumbSliderProps {
  values: MultiValue[];
  onChange: (event: Event, value: number | number[], activeThumb: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  "data-testid"?: string;
  "aria-label"?: string;
}

const SkillsRankingMultiThumbSlider: React.FC<SkillsRankingMultiThumbSliderProps> = ({
  values,
  onChange,
  disabled = false,
  min = 0,
  max = 100,
  step = 1,
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
}) => {
  const theme = useTheme();
  const sliderValues = values.map((v) => v.value);
  const maxSelectedValue = Math.max(...sliderValues);

  // Generate dynamic styles for each thumb based on the provided colors
  const dynamicThumbColors = values.reduce(
    (acc, value, index) => ({
      ...acc,
      [`& .MuiSlider-thumb[data-index="${index}"]`]: {
        backgroundColor: value.color,
      },
    }),
    {}
  );

  return (
    <Stack spacing={2} data-testid={dataTestId ? `${dataTestId}-container` : undefined}>
      <StyledSlider
        value={sliderValues}
        onChange={onChange}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        data-testid={dataTestId}
        aria-label={ariaLabel}
        valueLabelDisplay="off"
        valueLabelFormat={(value) => `${value}%`}
        sx={{
          "& .MuiSlider-track": {
            // Position the track from left edge (0%) to the max value
            left: "0% !important",
            width: `${(maxSelectedValue / max) * 100}% !important`,
            backgroundColor: theme.palette.primary.main,
          },
          ...dynamicThumbColors,
        }}
      />
      <Box display="flex" justifyContent="flex-end">
        <Stack spacing={1}>
          {values.map((value, index) => (
            <Stack
              key={index}
              direction="row"
              spacing={1}
              alignItems="center"
              data-testid={dataTestId ? `${dataTestId}-legend-item-${index}` : undefined}
            >
              <div
                style={{
                  width: theme.fixedSpacing(theme.tabiyaSpacing.md),
                  height: theme.fixedSpacing(theme.tabiyaSpacing.md),
                  backgroundColor: value.color,
                  borderRadius: theme.rounding(theme.tabiyaRounding.xs),
                }}
              />
              <Typography variant="body2">{value.label}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
};

export default SkillsRankingMultiThumbSlider;
