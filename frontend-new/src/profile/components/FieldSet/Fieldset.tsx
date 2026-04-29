import React, { useMemo } from "react";
import { Box, Skeleton, Typography } from "@mui/material";

type FieldsetProps = {
  label: string;
} & (
  | {
      isLoading: true;
    }
  | {
      value: string;
    }
);

const uniqueId = "d5d7e528-7ad8-4e67-9ba4-497d4db2c19c";

export const DATA_TEST_ID = {
  CONTAINER: `field-set-container-${uniqueId}`,
  LABEL: `field-set-label-${uniqueId}`,
  VALUE: `field-set-value-${uniqueId}`,
  SKELETON: `field-set-skeleton-${uniqueId}`,
};

export const Fieldset: React.FC<FieldsetProps> = (props) => {
  const { isLoading, value } = useMemo(() => {
    if ("isLoading" in props) {
      return { isLoading: true, value: undefined };
    }
    return { isLoading: false, value: props.value };
  }, [props]);

  return (
    <Box
      data-testid={DATA_TEST_ID.CONTAINER}
      sx={{ paddingBottom: (theme) => theme.fixedSpacing(theme.tabiyaSpacing.sm) }}
    >
      <Typography
        data-testid={DATA_TEST_ID.LABEL}
        sx={{
          display: "block",
          fontSize: "0.65rem",
          textTransform: "uppercase",
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "text.disabled",
          marginBottom: (theme) => theme.fixedSpacing(theme.tabiyaSpacing.xxs),
        }}
      >
        {props.label}
      </Typography>
      <Typography
        variant="body2"
        data-testid={DATA_TEST_ID.VALUE}
        sx={{
          color: "text.primary",
          fontWeight: 500,
          wordBreak: "break-word",
        }}
      >
        {isLoading ? (
          <Skeleton variant="text" sx={{ maxWidth: 220 }} data-testid={DATA_TEST_ID.SKELETON} />
        ) : (
          value || "—"
        )}
      </Typography>
    </Box>
  );
};
