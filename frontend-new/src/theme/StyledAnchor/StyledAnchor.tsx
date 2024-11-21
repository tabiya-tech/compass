import { styled } from "@mui/material";
import React from "react";

type Props = Omit<React.HTMLProps<HTMLAnchorElement>, "as" | "ref"> & {
  disabled?: boolean
}

// prevent forwarding the disabled prop to the anchor element
// Because the disabled prop is not a valid prop for an anchor element
// we need to prevent it from being forwarded.
const shouldForwardProp = (prop: string) => prop !== "disabled";

const getValueBasedOnState = (isDisabled: boolean, defaultValue: string, disabledValue: string) => {
  return isDisabled ? disabledValue : defaultValue;
};

const Styled =
  styled("a", { shouldForwardProp })<Props>(({ theme, disabled = false }) => ({
    color: getValueBasedOnState(disabled, theme.palette.tabiyaBlue.main, theme.palette.grey["500"]),
    textDecoration: "underline",
    cursor: getValueBasedOnState(disabled, "pointer", "not-allowed"),
    fontWeight: "bold",
    whiteSpace: "nowrap",
    "&:hover": {
      color: getValueBasedOnState(disabled, theme.palette.tabiyaBlue.light, theme.palette.grey["500"]),
    },
  }));

export const StyledAnchor: React.FC<Props> = ({ onClick, ...props }) => {

  // prevent the onClick event from firing if the anchor is disabled.
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      // if onclick was passed, no reason to redirect.
      e.preventDefault();
    }

    if (!props.disabled) {
      onClick?.(e)
    }
  };

  return <Styled
    aria-disabled={props.disabled}
    onClick={handleClick}
    {...props}
  />;
};
