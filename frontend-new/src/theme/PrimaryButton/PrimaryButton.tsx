import { Button, ButtonProps, Box, useTheme } from "@mui/material";
import { PaletteColor } from "@mui/material/styles";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import React, { useContext } from "react";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { ComponentError } from "src/error/commonErrors";

interface PrimaryButtonProps extends ButtonProps {
  disableWhenOffline?: boolean;
  showCircle?: boolean;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  style,
  disabled,
  children,
  disableWhenOffline,
  showCircle = false,
  color = "secondary",
  variant = "contained",
  sx,
  ...props
}: Readonly<PrimaryButtonProps>) => {
  const isOnline = useContext(IsOnlineContext);
  const theme = useTheme();

  if (!children) {
    throw new ComponentError("Children are required for PrimaryButton component");
  }

  const cream = theme.palette.tertiary.light;
  const paletteColor = theme.palette[color as keyof typeof theme.palette] as PaletteColor;
  const isOutlined = variant === "outlined";
  const sxObject = sx as Record<string, unknown> | undefined;
  const isSxObject = Boolean(sxObject && typeof sxObject === "object" && !Array.isArray(sxObject));
  const safeSxObject = isSxObject ? sxObject : undefined;
  const hasBackgroundOverride = Boolean(
    safeSxObject && ("backgroundColor" in safeSxObject || "bgcolor" in safeSxObject)
  );

  const useFilledCircle = isOutlined || hasBackgroundOverride;
  const circleBackgroundColor = useFilledCircle ? paletteColor.main : cream;
  const circleIconColor = useFilledCircle ? cream : paletteColor.main;

  const outlinedHoverSx = isOutlined
    ? {
        "&:hover:not(:disabled)": {
          backgroundColor: paletteColor.light,
          border: `2px solid ${paletteColor.main}`,
        },
      }
    : {};

  const containedOverrideHoverSx =
    !isOutlined && hasBackgroundOverride
      ? {
          "&:hover:not(:disabled)": {
            backgroundColor: paletteColor.light,
          },
        }
      : {};

  return (
    <Button
      variant={variant}
      color={color}
      style={style}
      sx={{
        borderRadius: "999px",
        fontFamily: "Bricolage Grotesque",
        fontWeight: 700,
        fontSize: "1rem",
        lineHeight: 1,
        gap: showCircle ? 1.5 : 1,
        justifyContent: showCircle ? "space-between" : "center",
        ...(isOutlined && { border: `2px solid ${paletteColor.main}` }),
        padding: showCircle ? "6px 6px 6px 22px" : "12px 24px",
        textTransform: "none",
        cursor: "pointer",
        "&:focus-visible": {
          outline: `3px solid ${theme.palette.accent.main}`,
          outlineOffset: "2px",
        },
        ...outlinedHoverSx,
        ...containedOverrideHoverSx,
        "&.Mui-disabled": {
          opacity: 0.4,
          color: isOutlined ? paletteColor.main : hasBackgroundOverride ? paletteColor.main : paletteColor.contrastText,
          backgroundColor: isOutlined ? "transparent" : hasBackgroundOverride ? cream : paletteColor.main,
          ...(isOutlined && { border: `2px solid ${paletteColor.main}` }),
          ...(showCircle &&
            hasBackgroundOverride && {
              "& > .MuiBox-root": {
                backgroundColor: paletteColor.main,
                color: cream,
              },
            }),
        },
        ...sx,
      }}
      disableElevation
      disabled={Boolean(disabled || (disableWhenOffline && !isOnline))}
      {...props}
    >
      {children}
      {showCircle && (
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            backgroundColor: circleBackgroundColor,
            color: circleIconColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "transform 0.2s ease",
            "button:hover:not(:disabled) &": {
              transform: "translateX(3px)",
            },
          }}
        >
          <ArrowForwardIcon sx={{ fontSize: 18 }} />
        </Box>
      )}
    </Button>
  );
};

export default PrimaryButton;
