import { styled } from "@mui/material";

export const StyledAnchor = styled("a")(({ theme }) => ({
  color: theme.palette.tabiyaBlue.main,
  textDecoration: "underline",
  cursor: "pointer",
  fontWeight: "bold",
  whiteSpace: "nowrap",
  "&:hover": {
    color: theme.palette.tabiyaBlue.light,
  },
}));
