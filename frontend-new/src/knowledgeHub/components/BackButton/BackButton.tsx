import React, { startTransition } from "react";
import { useTheme } from "@mui/material";
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
    <CustomLink
      onClick={() => {
        startTransition(() => {
          onClick();
        });
      }}
      data-testid={DATA_TEST_ID.BACK_BUTTON}
      sx={{
        display: "inline-flex",
        alignItems: "flex-start",
        gap: 0.5,
        fontSize: "0.85rem",
        color: theme.palette.secondary.dark,
        textDecoration: "none",
        "&:hover": {
          color: theme.palette.secondary.main,
          textDecoration: "underline",
        },
      }}
    >
      <ArrowBackIcon sx={{ fontSize: "1rem" }} />
      {t(labelKey as TranslationKey)}
    </CustomLink>
  );
};

export default BackButton;
