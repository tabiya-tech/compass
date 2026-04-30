import React, { startTransition, useCallback } from "react";
import { Box, useTheme } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageContextMenu from "src/i18n/languageContextMenu/LanguageContextMenu";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";
import { routerPaths } from "src/app/routerPaths";

export const shapesBackgroundUrl = `${process.env.PUBLIC_URL}/Shapes.svg`;

const uniqueId = "9ad2f1c6-3e08-4b49-9f7d-4c8a1e3d5b27";

export const DATA_TEST_ID = {
  AUTH_PAGE_SHELL_FAQ_BUTTON: `auth-page-shell-faq-button-${uniqueId}`,
};

export type AuthPageShellProps = {
  logoUrl: string;
  children: React.ReactNode;
  whiteBandContent?: React.ReactNode;
  whiteContainerTestId?: string;
};

const layoutCssVarsSx = (theme: Theme) => ({
  "--layout-content-max-width": "80rem",
  "--layout-gutter-x": {
    xs: theme.fixedSpacing(theme.tabiyaSpacing.md),
    md: theme.spacing(theme.tabiyaSpacing.xl),
  },
});

export const layoutContentColumnSx = {
  width: "100%",
  maxWidth: "var(--layout-content-max-width)",
  marginLeft: "auto",
  marginRight: "auto",
  paddingLeft: "var(--layout-gutter-x)",
  paddingRight: "var(--layout-gutter-x)",
  boxSizing: "border-box",
} as const;

const AuthPageShell: React.FC<AuthPageShellProps> = ({ logoUrl, whiteBandContent, children, whiteContainerTestId }) => {
  const theme = useTheme();
  const cream = theme.palette.common.cream;
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isOnFaqPage = location.pathname === routerPaths.FAQ;

  const handleFaqClick = useCallback(() => {
    startTransition(() => {
      navigate(routerPaths.FAQ);
    });
  }, [navigate]);

  const pt = { xs: 4, md: 6 };
  const pb = { xs: 6, md: 2 };

  return (
    <Box
      sx={(t) => ({
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        position: "relative",
        ...layoutCssVarsSx(t),
      })}
    >
      <Box
        sx={{
          width: "100%",
          flexShrink: 0,
          position: "relative",
          zIndex: 2,
          backgroundColor: theme.palette.common.white,
          overflow: "visible",
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            backgroundImage: `url(${shapesBackgroundUrl})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center center",
            backgroundSize: "cover",
            opacity: 0.35,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <Box
          data-testid={whiteContainerTestId}
          sx={{
            ...layoutContentColumnSx,
            position: "relative",
            zIndex: 1,
          }}
        >
          <Box sx={{ position: "relative", pt, pb }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: whiteBandContent ? { xs: 2, md: 3 } : 0,
              }}
            >
              <Box
                component="img"
                src={logoUrl}
                alt=""
                sx={{ maxHeight: { xs: 36, md: 44 }, width: "auto", maxWidth: "min(200px, 45vw)" }}
              />
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {!isOnFaqPage && (
                  <SecondaryButton
                    color="brandAction"
                    onClick={handleFaqClick}
                    startIcon={<HelpCircle size={18} />}
                    aria-label={t("nav.faqAriaLabel")}
                    data-testid={DATA_TEST_ID.AUTH_PAGE_SHELL_FAQ_BUTTON}
                    sx={{
                      alignSelf: "center",
                      paddingY: 0.75,
                      paddingX: 2,
                      fontSize: "0.875rem",
                      "& .MuiButton-startIcon": { marginRight: 0.75 },
                    }}
                  >
                    {t("nav.faq")}
                  </SecondaryButton>
                )}
                <LanguageContextMenu removeMargin />
              </Box>
            </Box>
            {whiteBandContent}
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          width: "100%",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          backgroundColor: cream,
          zIndex: 1,
          overflow: "visible",
          position: "relative",
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default AuthPageShell;
