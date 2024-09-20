import React from "react";
import { IconButton, IconButtonProps, styled } from "@mui/material";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";

interface PrimaryIconButtonProps extends IconButtonProps {}

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  borderRadius: theme.spacing(theme.tabiyaSpacing.sm),
  lineHeight: "0",
  padding: theme.spacing(theme.tabiyaSpacing.xs),
  color: theme.palette.primary.main,
  ":hover": {
    backgroundColor: theme.palette.secondary.dark,
    color: theme.palette.secondary.contrastText,
  },
  ":active": {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
}));

const PrimaryIconButton: React.FC<PrimaryIconButtonProps> = ({
  children,
  disabled,
  ...props
}: Readonly<PrimaryIconButtonProps>) => {
  return (
    <StyledIconButton color={"primary"} disabled={Boolean(disabled)} {...props}>
      {children ?? <CircleOutlinedIcon sx={{ padding: 0, margin: 0 }} />}
    </StyledIconButton>
  );
};

export default PrimaryIconButton;
