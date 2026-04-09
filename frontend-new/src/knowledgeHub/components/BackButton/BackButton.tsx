import React, { startTransition } from "react";
import { Box, useTheme } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTranslation } from "react-i18next";
import { TranslationKey } from "src/react-i18next";
import CustomLink from "src/theme/CustomLink/CustomLink";

const uniqueId = "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d";

export const DATA_TEST_ID = {
  BACK_BUTTON: `back-button-${uniqueId}`,
};

export interface BackButtonProps {
  onClick: () => void;
  labelKey: string; // Translation key for the button text
  dataTestId?: string;
}

const BackButton: React.FC<BackButtonProps> = ({ onClick, labelKey, dataTestId }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "var(--layout-content-max-width)",
        mx: "auto",
        px: "var(--layout-gutter-x)",
        py: theme.spacing(theme.tabiyaSpacing.sm),
      }}
    >
      <CustomLink
        onClick={() => {
          startTransition(() => {
            onClick();
          });
        }}
        data-testid={DATA_TEST_ID.BACK_BUTTON}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          fontSize: "0.9rem",
          fontWeight: 500,
          color: theme.palette.tabiyaGreen.dark,
          textDecoration: "none",
          "&:hover": {
            textDecoration: "underline",
          },
        }}
      >
        <ArrowBackIcon sx={{ fontSize: "1rem" }} />
        {t(labelKey as TranslationKey)}
      </CustomLink>
    </Box>
  );
};

export default BackButton;
