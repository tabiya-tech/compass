import React from "react";
import { Box, useTheme } from "@mui/material";

const uniqueId = "bucket-level-7f3d-4a2b-9c1e-8d5f6a3b2c1d";

export const DATA_TEST_ID = {
  BUCKET_LEVEL_CONTAINER: `bucket-level-container-${uniqueId}`,
  BUCKET_LEVEL_TEXT: `bucket-level-text-${uniqueId}`,
};

export interface BucketLevelProps {
  fillLevel: number; // 0-100 percentage
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  "data-testid"?: string;
}

const BucketLevel: React.FC<BucketLevelProps> = ({
  fillLevel,
  onClick,
  disabled = false,
  selected = false,
  "data-testid": dataTestId,
}) => {
  const theme = useTheme();
  const fillHeight = Math.min(Math.max(fillLevel, 0), 100);
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap={theme.fixedSpacing(theme.tabiyaSpacing.xs)}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        padding: theme.fixedSpacing(theme.tabiyaSpacing.xs),
        borderRadius: theme.fixedSpacing(theme.tabiyaSpacing.sm),
        border: `2px solid ${theme.palette.tabiyaBlue.main}`,
        backgroundColor: selected ? theme.palette.primary.main : "transparent",
        "&:hover": {
          backgroundColor: disabled ? "transparent" : theme.palette.action.hover,
        },
      }}
      data-testid={dataTestId || DATA_TEST_ID.BUCKET_LEVEL_CONTAINER}
    >
      <svg width="48" height="48" viewBox="0 0 94 69" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Bucket outline */}
        <path
          d="M87.2345 2.4648C85.8517 0.8984 83.8556 0 81.7697 0L24.5427 0.0039072C22.4529 0.0039072 20.4568 0.902348 19.0739 2.47271C17.6911 4.03911 17.0466 6.12891 17.3083 8.19931L17.7536 11.7696C16.0505 13.1954 14.0427 15.0196 12.4645 16.6016C0.58147 28.4806 -3.42253 42.3946 3.14807 48.9646C5.22227 51.0388 8.06607 52.0896 11.4567 52.0896C13.5778 52.0896 15.9098 51.6795 18.3903 50.8513C24.1208 48.9411 30.2023 44.9646 35.5113 39.6483L55.4093 19.7533C56.632 18.5306 56.632 16.5541 55.4093 15.3353C54.1866 14.1126 52.2101 14.1126 50.9913 15.3353L31.0933 35.2303C29.898 36.4295 28.6597 37.5389 27.4019 38.5662L23.5074 7.42121C23.4527 7.01887 23.6402 6.73762 23.7613 6.60871C23.8746 6.4759 24.1324 6.25324 24.5425 6.25324H81.7695C82.1758 6.25324 82.4336 6.47199 82.5508 6.6048C82.6641 6.73761 82.8516 7.01886 82.8047 7.42121L75.9688 62.1052C75.6446 64.7068 73.4219 66.6677 70.8008 66.6677H35.5158C32.8947 66.6677 30.672 64.7068 30.3478 62.1052L29.0119 51.4332C27.051 52.6559 25.0744 53.6676 23.1017 54.523L24.1486 62.8785C24.8634 68.6012 29.7502 72.9175 35.5156 72.9175H70.8006C76.5662 72.9175 81.4526 68.6011 82.1676 62.8825L89.0035 8.19851C89.2652 6.12431 88.6168 4.03441 87.234 2.46801L87.2345 2.4648ZM16.4185 44.9218C12.3794 46.2695 9.15676 46.1288 7.56686 44.5468C4.21526 41.1913 7.48483 30.4178 16.8833 21.0198C17.4301 20.4729 18.0552 19.8792 18.6919 19.2854L21.5942 42.5084C19.8481 43.4967 18.1059 44.3561 16.4145 44.9225L16.4185 44.9218Z"
          stroke={theme.palette.tabiyaBlue.main}
          strokeWidth="2"
          fill={theme.palette.tabiyaBlue.main}
        />
        {/* Fill level - default state */}
        <rect
          x="24"
          y={67 - (fillHeight / 100) * 60}
          width="60"
          height={(fillHeight / 100) * 60}
          fill={theme.palette.tabiyaBlue.main}
          fillOpacity={selected ? 0.6 : 0.3}
          style={{
            transition: "all 0.3s ease-in-out",
            transform: isHovered ? "scaleY(0)" : "scaleY(1)",
            transformOrigin: "bottom",
          }}
        />
        {/* Fill level - hover state */}
        <rect
          x="24"
          y={67 - (fillHeight / 100) * 60}
          width="60"
          height={(fillHeight / 100) * 60}
          fill={theme.palette.tabiyaBlue.main}
          fillOpacity={0.6}
          style={{
            transition: "all 0.3s ease-in-out",
            transform: isHovered ? "scaleY(1)" : "scaleY(0)",
            transformOrigin: "bottom",
          }}
        />
      </svg>
    </Box>
  );
};

export default BucketLevel; 