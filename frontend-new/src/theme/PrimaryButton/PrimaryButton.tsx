import { Button, ButtonProps } from "@mui/material";
import React, { useContext } from "react";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { ComponentError } from "src/error/commonErrors";

interface PrimaryButtonProps extends ButtonProps {
  // Add additional props specific to PrimaryButton Button here
  disableWhenOffline?: boolean;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  style,
  disabled,
  children,
  disableWhenOffline,
  sx,
  ...props
}: Readonly<PrimaryButtonProps>) => {
  const isOnline = useContext(IsOnlineContext);

  if (!children) {
    throw new ComponentError("Children are required for PrimaryButton component");
  }

  return (
    // props are passed to the component last, so that they can override the default values
    <Button
      variant={"contained"}
      color={"primary"}
      style={style}
      sx={{
        borderRadius: (theme) => theme.fixedSpacing(theme.tabiyaRounding.xl),
        paddingY: (theme) => theme.fixedSpacing(theme.tabiyaSpacing.xs),
        paddingX: (theme) => theme.fixedSpacing(theme.tabiyaSpacing.md),
        ...sx,
      }}
      disableElevation
      disabled={Boolean(disabled || (disableWhenOffline && !isOnline))}
      {...props}
    >
      {children ?? "Click here"}
    </Button>
  );
};

export default PrimaryButton;
