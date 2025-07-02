import { TextField, TextFieldProps, styled } from "@mui/material";

export type InlineEditFieldProps = TextFieldProps & {
  "data-testid": string
};

const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      border: "none",
    },
    padding: 0,
  },
  "& .MuiInputBase-input": {
    padding: 0,
    paddingHorizontal: theme.fixedSpacing(theme.tabiyaSpacing.sm),
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.secondary,
    background: "transparent !important",
  },
  width: "100%",
  backgroundColor: theme.palette.grey[100],
  borderRadius: theme.fixedSpacing(theme.tabiyaRounding.sm),
  padding: theme.fixedSpacing(theme.tabiyaSpacing.xs),
}));

const InlineEditField: React.FC<InlineEditFieldProps> = (props) => {
  return <StyledTextField {...props} />;
};

export default InlineEditField