import React from "react";
import { IconButton, IconButtonProps, styled, useTheme } from "@mui/material";
import { PaletteColor } from "@mui/material/styles";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  borderRadius: "50%",
  lineHeight: "0",
  padding: theme.spacing(theme.tabiyaSpacing.xs),
  color: theme.palette.secondary.main,
  ":hover": {
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.secondary.contrastText,
  },
  ":active": {
    backgroundColor: theme.palette.secondary.dark,
    color: theme.palette.secondary.contrastText,
  },
  "&.Mui-disabled": {
    opacity: 0.38,
  },
  "& .MuiTouchRipple-root": {
    display: "none",
  },
}));

interface PrimaryIconButtonProps extends IconButtonProps {
  /** Show a solid circular background behind the icon */
  filled?: boolean;
}

const PrimaryIconButton: React.FC<PrimaryIconButtonProps> = ({
  children,
  disabled,
  filled = false,
  color = "secondary",
  sx,
  ...props
}: Readonly<PrimaryIconButtonProps>) => {
  const theme = useTheme();
  const paletteColor = theme.palette[color as keyof typeof theme.palette] as PaletteColor;

  return (
    <StyledIconButton
      color={color}
      disabled={Boolean(disabled)}
      sx={{
        ...(filled && {
          bgcolor: paletteColor.main,
          color: paletteColor.contrastText,
          "&:hover": {
            bgcolor: paletteColor.dark,
          },
          "&.Mui-disabled": {
            color: paletteColor.contrastText,
            bgcolor: paletteColor.main,
          },
        }),
        ...sx,
      }}
      {...props}
    >
      {children ?? <CircleOutlinedIcon sx={{ padding: 0, margin: 0 }} />}
    </StyledIconButton>
  );
};

export default PrimaryIconButton;
