import { ButtonProps } from "@mui/material";
import React, { useContext } from "react";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { ComponentError } from "src/error/commonErrors";

interface SecondaryButtonProps extends ButtonProps {
  disableWhenOffline?: boolean;
  showCircle?: boolean;
}

const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  style,
  disabled,
  children,
  disableWhenOffline,
  sx,
  ...props
}: Readonly<SecondaryButtonProps>) => {
  const isOnline = useContext(IsOnlineContext);

  if (!children) {
    throw new ComponentError("Children are required for SecondaryButton component");
  }

  return (
    // props are passed to the component last, so that they can override the default values
    <PrimaryButton
      variant="outlined"
      style={style}
      sx={{ alignSelf: "flex-start", ...sx }}
      disabled={Boolean(disabled || (disableWhenOffline && !isOnline))}
      {...props}
    >
      {children ?? "Click here"}
    </PrimaryButton>
  );
};

export default SecondaryButton;
