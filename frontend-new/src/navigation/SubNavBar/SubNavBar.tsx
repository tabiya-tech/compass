import React, { startTransition } from "react";
import { Box, Typography, useTheme, useMediaQuery } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { PaletteColor, Theme } from "@mui/material/styles";
import type { SxProps } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import { useTranslation } from "react-i18next";
import type { TranslationKey } from "src/react-i18next";

const uniqueId = "a7b3e9f1-2d4c-4a8b-b6e5-1f0c3d9a8b7e";

export const DATA_TEST_ID = {
  SUB_NAVBAR_CONTAINER: `sub-navbar-container-${uniqueId}`,
  SUB_NAVBAR_TITLE: `sub-navbar-title-${uniqueId}`,
  SUB_NAVBAR_SUBTITLE: `sub-navbar-subtitle-${uniqueId}`,
  SUB_NAVBAR_BACK_LINK: `sub-navbar-back-link-${uniqueId}`,
};

export interface SubNavBarProps {
  title: string;
  subtitle: string;
  headerColor: string;
  labelAbove?: boolean;
  backLabelKey?: TranslationKey;
  backTo?: string;
}

const SubNavBar: React.FC<SubNavBarProps> = ({
  title,
  subtitle,
  headerColor,
  labelAbove = false,
  backLabelKey = "home.backToDashboard",
  backTo = routerPaths.ROOT,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("md"));

  const paletteColor = theme.palette[headerColor as keyof typeof theme.palette] as PaletteColor;
  const bgColor = paletteColor?.main ?? theme.palette.primary.main;
  const textColor = paletteColor?.contrastText ?? theme.palette.primary.contrastText;

  const backLinkSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    color: "white",
    opacity: 0.85,
    fontSize: "0.9rem",
    fontWeight: 500,
    textDecoration: "none",
    cursor: "pointer",
    "&:hover": {
      textDecoration: "underline",
    },
  };

  const headingVariant = isMobile ? "h5" : "h4";
  const headingSx: SxProps<Theme> = { color: alpha(theme.palette.common.white, 0.8), fontWeight: 700 };
  const labelSx: SxProps<Theme> = { color: textColor, fontWeight: 500 };
  const subtitleSx: SxProps<Theme> = { color: textColor, mt: 0.4, fontWeight: 400 };

  const topText = title;
  const topVariant = labelAbove ? "overline" : headingVariant;
  const topStyle = labelAbove ? labelSx : headingSx;
  const bottomText = subtitle;
  const bottomVariant = labelAbove ? headingVariant : "body2";
  const bottomStyle = labelAbove ? headingSx : subtitleSx;

  return (
    <Box
      sx={{
        backgroundColor: bgColor,
        color: textColor,
        borderTop: `1px solid ${theme.palette.common.white}33`,
        paddingTop: theme.spacing(theme.tabiyaSpacing.sm),
        paddingBottom: theme.spacing(theme.tabiyaSpacing.sm),
      }}
      data-testid={DATA_TEST_ID.SUB_NAVBAR_CONTAINER}
    >
      <Box
        sx={{
          width: "100%",
          paddingX: "var(--layout-gutter-x)",
          position: "relative",
          minHeight: isMobile ? undefined : 56,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "center",
          gap: 0,
        }}
      >
        <Box sx={{ textAlign: "center", width: "100%" }}>
          <Typography variant={topVariant} sx={topStyle} data-testid={DATA_TEST_ID.SUB_NAVBAR_TITLE}>
            {topText}
          </Typography>
          <Typography variant={bottomVariant} sx={bottomStyle} data-testid={DATA_TEST_ID.SUB_NAVBAR_SUBTITLE}>
            {bottomText}
          </Typography>
        </Box>
        <Box
          sx={{
            ...backLinkSx,
            ...(isMobile && {
              mt: 1.5,
              alignSelf: "flex-start",
              width: "100%",
            }),
            ...(!isMobile && {
              position: "absolute",
              left: "var(--layout-gutter-x)",
              top: "50%",
              transform: "translateY(-50%)",
              justifyContent: "flex-start",
            }),
          }}
          onClick={() => {
            startTransition(() => {
              navigate(backTo);
            });
          }}
          data-testid={DATA_TEST_ID.SUB_NAVBAR_BACK_LINK}
        >
          <ArrowBackIcon sx={{ fontSize: "1rem" }} />
          {t(backLabelKey)}
        </Box>
      </Box>
    </Box>
  );
};

export default SubNavBar;
