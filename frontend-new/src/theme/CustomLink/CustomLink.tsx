import { Link, styled, LinkProps } from "@mui/material";

interface CustomLinkProps extends LinkProps {
  disabled?: boolean;
}

const CustomLink = styled(Link)<CustomLinkProps>(({ theme, disabled }) => ({
  color: disabled ? theme.palette.text.disabled : theme.palette.text.primary,
  opacity: disabled ? "0.5" : "1",
  cursor: disabled ? "not-allowed" : "pointer",
  textDecoration: "underline",
  pointerEvents: disabled ? "none" : "auto",
  fontWeight: "bold",
  whiteSpace: "nowrap",
  "&:hover": {
    color: disabled ? theme.palette.text.textAccent : theme.palette.grey["500"]
  },
}));

// Forward the disabled prop to aria-disabled attribute
const StyledCustomLink = (props: CustomLinkProps) => (
  <CustomLink {...props} aria-disabled={props.disabled} />
);

export default StyledCustomLink; 

