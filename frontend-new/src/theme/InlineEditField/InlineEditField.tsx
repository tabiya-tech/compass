import { Badge, TextField, TextFieldProps, styled, useTheme } from "@mui/material";

const uniqueId = "be128c36-2209-4d9d-8557-648dcb14ca88";

export const DATA_TEST_ID = {
  INLINE_EDIT_FIELD_BADGE: `inline-edit-field-badge-${uniqueId}`,
};

export type InlineEditFieldProps = TextFieldProps & {
  "data-testid": string;
  showEditBadge?: boolean;
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

const InlineEditField: React.FC<InlineEditFieldProps> = ({ showEditBadge = false, ...props }) => {
  const theme = useTheme();

  const field = <StyledTextField {...props} />;

  return (
    <Badge
      variant="dot"
      invisible={!showEditBadge}
      anchorOrigin={{
        vertical: "top",
        horizontal: "left",
      }}
      sx={{
        width: "100%",
        "& .MuiBadge-badge": {
          backgroundColor: theme.palette.grey[300],
          top: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
          left: theme.fixedSpacing(theme.tabiyaSpacing.xxs),
        },
      }}
      data-testid={DATA_TEST_ID.INLINE_EDIT_FIELD_BADGE}
    >
      {field}
    </Badge>
  );
};

export default InlineEditField;
