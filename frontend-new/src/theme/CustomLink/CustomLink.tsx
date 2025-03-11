import { Link, styled, LinkProps } from "@mui/material";
import { useContext } from "react";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";

interface CustomLinkProps extends LinkProps {
  disabled?: boolean;
  disableWhenOffline?: boolean;
}

const StyledLink = styled(Link)<CustomLinkProps>(({ theme, disabled }) => ({
  color: disabled ? theme.palette.text.disabled : theme.palette.text.primary,
  opacity: disabled ? 0.5 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
  textDecoration: "underline",
  pointerEvents: disabled ? "none" : "auto",
  fontWeight: disabled ? "normal" : "bold",
  whiteSpace: "nowrap",
  "&:hover": {
    color: disabled ? theme.palette.text.textAccent : theme.palette.grey["500"],
  },
}));

// Forward the disabled prop to aria-disabled attribute
const CustomLink = (props: CustomLinkProps) => {
  const isOnline = useContext(IsOnlineContext);
  const { disableWhenOffline, ...restProps } = props;
  const isDisabled = Boolean(props.disabled || (disableWhenOffline && !isOnline));

  return <StyledLink {...restProps} disabled={isDisabled} aria-disabled={isDisabled} />;
};

export default CustomLink;
