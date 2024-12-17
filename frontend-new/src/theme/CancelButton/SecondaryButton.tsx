import { Button, ButtonProps } from "@mui/material";
import React, { useContext } from "react";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";

interface SecondaryButtonProps extends ButtonProps {
  // Add additional props specific to SecondaryButton Button here
  disableWhenOffline?: boolean;
}

const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  style,
  disabled,
  children,
  disableWhenOffline,
  ...props
}: Readonly<SecondaryButtonProps>) => {
  const isOnline = useContext(IsOnlineContext);

  return (
    // props are passed to the component last, so that they can override the default values
    <Button
      variant={"text"}
      style={style}
      sx={{
        borderRadius: (theme) => theme.tabiyaRounding.xl,
        paddingY: (theme) => theme.fixedSpacing(theme.tabiyaSpacing.xs),
        paddingX: (theme) => theme.fixedSpacing(theme.tabiyaSpacing.md),
        color: (theme) => theme.palette.text.secondary
      }}
      disableElevation
      disabled={Boolean(disabled || (disableWhenOffline && !isOnline))}
      {...props}
    >
      {children ?? "Click here"}
    </Button>
  );
};

export default SecondaryButton;
