import React, { useCallback, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AuthPageShell, { layoutContentColumnSx } from "src/auth/components/AuthPageShell/AuthPageShell";
import Footer from "src/home/components/Footer/Footer";
import { getDarkLogoUrl, getLogoUrl, getProductName, getRegistrationDisabled } from "src/envService";
import { AuthPageProvider } from "src/auth/components/AuthLayout/AuthPageContext";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import { routerPaths } from "src/app/routerPaths";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";

const FeatureColumn: React.FC<{
  imageSrc: string;
  title: string;
  body: string;
  imageMaxWidth?: { xs: number; md: number };
}> = ({ imageSrc, title, body, imageMaxWidth = { xs: 220, md: 260 } }) => (
  <Box
    sx={{
      width: "100%",
      textAlign: "center",
      px: { xs: 1, md: 0 },
      display: "grid",
      gridRow: { xs: "auto", md: "1 / -1" },
      gridTemplateRows: { xs: "auto auto auto", md: "subgrid" },
      justifyItems: "center",
    }}
  >
    <Box
      sx={{
        width: "100%",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <Box
        component="img"
        src={imageSrc}
        alt=""
        sx={{
          width: "auto",
          maxWidth: imageMaxWidth,
          maxHeight: "100%",
          objectFit: "contain",
        }}
      />
    </Box>
    <Typography
      variant="h3"
      sx={{
        mt: 0.5,
        mb: 0,
        maxWidth: 300,
        textAlign: "center",
        width: "100%",
        alignSelf: "flex-start",
      }}
    >
      {title}
    </Typography>
    <Typography
      variant="body2"
      sx={{
        maxWidth: 320,
        lineHeight: 1.4,
        letterSpacing: "-0.02em",
        alignSelf: "start",
        marginTop: 0.5,
      }}
    >
      {body}
    </Typography>
  </Box>
);

const AuthLayout: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [loadingState, setLoadingState] = useState({
    isLoading: false,
    loadingMessage: undefined as string | undefined,
  });
  const registrationDisabled = getRegistrationDisabled().toLowerCase() === "true";
  const isRegisterRoute = location.pathname === routerPaths.REGISTER;
  const showRegisterLink = location.pathname === routerPaths.LOGIN && !registrationDisabled;
  const showLoginLink = isRegisterRoute;

  const handleStateChange = useCallback(
    ({ isLoading, loadingMessage }: { isLoading: boolean; loadingMessage?: string }) => {
      setLoadingState({ isLoading, loadingMessage });
    },
    []
  );

  const logoSrc = getDarkLogoUrl() || getLogoUrl() || `${process.env.PUBLIC_URL}/njila-logo-dark.svg`;
  const appName = getProductName();

  const whiteBandContent = (
    <Box
      sx={{
        display: "flex",
        position: "relative",
        flexDirection: { xs: "column", md: "row" },
        alignItems: "center",
        gap: { xs: 3, md: 2, lg: 0 },
        pt: theme.fixedSpacing(2),
      }}
    >
      <Box
        sx={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          flex: { md: 1 },
          maxWidth: { md: 320, lg: "none" },
          pr: { lg: 4 },
          mr: { md: "auto", lg: 0 },
          minWidth: 0,
        }}
      >
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: "48px", lg: "64px" },
            lineHeight: 0.9,
            letterSpacing: "-0.06em",
            whiteSpace: "normal",
          }}
        >
          {t("auth.pages.login.appHero.discoverLine")}
        </Typography>
        <Typography
          variant="h1"
          sx={{
            marginBottom: theme.fixedSpacing(theme.tabiyaSpacing.sm),
            color: theme.palette.primary.main,
            fontSize: { xs: "48px", lg: "64px" },
            lineHeight: 0.9,
            letterSpacing: "-0.06em",
            whiteSpace: "normal",
          }}
        >
          {t("auth.pages.login.appHero.skillsLine")}
          <Box component="span" marginLeft={theme.fixedSpacing(theme.tabiyaSpacing.xs)}>
            .
          </Box>
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            lineHeight: 1.4,
            letterSpacing: "-0.02em",
            maxWidth: 450,
            whiteSpace: "normal",
          }}
        >
          {t("auth.pages.login.appHero.subheadline", { appName })}
        </Typography>
      </Box>

      <Box
        sx={{
          width: { xs: "100%", md: 360, lg: 420 },
          minWidth: { md: 360, lg: 420 },
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        <Box
          component="img"
          src={`${process.env.PUBLIC_URL}/climber.svg`}
          alt=""
          sx={{
            display: "block",
            position: { xs: "static", md: "absolute" },
            right: { md: "100%" },
            bottom: { md: -84, lg: -94 },
            width: { xs: "min(100%, 320px)", md: 320, lg: 360 },
            maxWidth: "100%",
            height: "auto",
            maxHeight: { md: 420, lg: 540 },
            objectFit: "contain",
            zIndex: 3,
            mx: { xs: "auto", md: 0 },
            mr: { md: -4.5, lg: -3.5 },
            my: { xs: theme.fixedSpacing(2), md: 0 },
          }}
        />
        <Box
          sx={{
            backgroundColor: isRegisterRoute ? theme.palette.primary.main : theme.palette.brandAction.main,
            borderRadius: 2,
            p: theme.fixedSpacing(4),
            width: "100%",
            maxWidth: { xs: 420, md: 360, lg: 420 },
            overflowY: "auto",
            overflowX: "hidden",
            boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.12)}`,
            color: theme.palette.common.white,
            position: "relative",
            zIndex: 2,
          }}
        >
          <Outlet />
        </Box>
        {(showRegisterLink || showLoginLink) && (
          <Box
            sx={{
              mt: theme.fixedSpacing(2),
              width: "100%",
              maxWidth: { xs: 420, md: 360, lg: 420 },
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: theme.fixedSpacing(theme.tabiyaSpacing.sm),
              position: "relative",
              zIndex: 4,
              overflow: "visible",
              boxSizing: "border-box",
            }}
          >
            <Typography
              sx={{
                textAlign: "center",
                color: theme.palette.text.primary,
                fontWeight: 700,
                width: "100%",
                maxWidth: "100%",
                px: theme.fixedSpacing(theme.tabiyaSpacing.md),
                fontSize: theme.typography.subtitle1.fontSize,
                overflowWrap: "break-word",
              }}
            >
              {showRegisterLink ? t("auth.pages.login.dontHaveAnAccount") : t("auth.pages.register.alreadyHaveAccount")}
            </Typography>
            <SecondaryButton
              showCircle
              onClick={() => navigate(showRegisterLink ? routerPaths.REGISTER : routerPaths.LOGIN)}
              color={showRegisterLink ? "brandAction" : "primary"}
              sx={{ alignSelf: "center" }}
            >
              {showRegisterLink ? t("common.buttons.registerLink") : t("common.buttons.loginLink", { appName })}
            </SecondaryButton>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <AuthPageProvider onStateChange={handleStateChange}>
      <AuthPageShell logoUrl={logoSrc} whiteBandContent={whiteBandContent}>
        <Box
          sx={{
            ...layoutContentColumnSx,
            pt: { xs: 8, md: 6 },
            pb: { xs: 3, md: 4 },
          }}
        >
          <Typography variant="h2" sx={{ fontWeight: 700, textAlign: "start", mb: theme.fixedSpacing(4) }}>
            {t("auth.pages.login.appHero.whatIsTitleBefore")}{" "}
            <Box component="span" sx={{ color: theme.palette.brandAction.main }}>
              {t("auth.pages.login.appHero.whatIsTitleBrand", { appName })}
            </Box>
            ?
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
              gridTemplateRows: { xs: "repeat(6, auto)", md: "minmax(148px, auto) auto auto" },
              rowGap: { xs: theme.fixedSpacing(4), md: 0 },
              columnGap: { xs: 0, md: 1 },
            }}
          >
            <FeatureColumn
              imageSrc={`${process.env.PUBLIC_URL}/conversation.svg`}
              title={t("auth.pages.login.appHero.feature1Title")}
              body={t("auth.pages.login.appHero.feature1Body")}
              imageMaxWidth={{ xs: 220, md: 350 }}
            />
            <FeatureColumn
              imageSrc={`${process.env.PUBLIC_URL}/resume.svg`}
              title={t("auth.pages.login.appHero.feature2Title")}
              body={t("auth.pages.login.appHero.feature2Body")}
            />
            <FeatureColumn
              imageSrc={`${process.env.PUBLIC_URL}/runner.svg`}
              title={t("auth.pages.login.appHero.feature3Title")}
              body={t("auth.pages.login.appHero.feature3Body")}
              imageMaxWidth={{ xs: 220, md: 240 }}
            />
          </Box>
        </Box>

        <Footer sx={{ mt: "auto", backgroundColor: theme.palette.common.cream }} />
      </AuthPageShell>
      <Backdrop isShown={loadingState.isLoading} message={loadingState.loadingMessage} />
    </AuthPageProvider>
  );
};

export default AuthLayout;
