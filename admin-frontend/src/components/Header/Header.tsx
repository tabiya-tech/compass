import React, { useEffect, useMemo, useState, startTransition } from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import LanguageContextMenu from "src/i18n/languageContextMenu/LanguageContextMenu";
import { routerPaths } from "src/app/routerPaths";
import { getDarkLogoUrl } from "src/envService";
import StdFirebaseAuthenticationService from "src/auth/services/FirebaseAuthenticationService/StdFirebaseAuthenticationService";
import AuthenticationStateService from "src/auth/services/AuthenticationState.service";
import UserStateService from "src/userState/UserStateService";

const uniqueId = "795432d7-a55d-47a2-93cf-85aeb3de2bde";

export const DATA_TEST_ID = {
  HEADER_CONTAINER: `page-header-container-${uniqueId}`,
  HEADER_LOGO_LINK: `page-header-logo-link-${uniqueId}`,
  HEADER_LOGO: `page-header-logo-${uniqueId}`,
  HEADER_BUTTON_USER: `page-header-button-user-${uniqueId}`,
};

const Header: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const preferredLogoSrc = getDarkLogoUrl() || `${process.env.PUBLIC_URL}/njila-logo-dark.svg`;
  const [logoSrc, setLogoSrc] = useState(preferredLogoSrc);

  useEffect(() => {
    setLogoSrc(preferredLogoSrc);
  }, [preferredLogoSrc]);

  const contextMenuItems: MenuItemConfig[] = useMemo(
    () => [
      {
        id: "logout",
        text: t("header.logout").toLowerCase(),
        disabled: false,
        action: async () => {
          setAnchorEl(null);
          await StdFirebaseAuthenticationService.getInstance().logout();
          AuthenticationStateService.getInstance().clearUser();
          UserStateService.getInstance().clearUserState();
          startTransition(() => {
            navigate(routerPaths.LOGIN, { replace: true });
          });
        },
      },
    ],
    [navigate, t]
  );

  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: theme.zIndex.appBar,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      {/*Zambia flag stripe*/}
      <Box
        sx={{
          width: "100%",
          height: isMobile ? 5 : 8,
          "& svg": {
            display: "block",
            width: "100%",
            height: "100%",
          },
        }}
      >
        <svg viewBox="0 0 1000 10" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="0,0 270,0 250,10 0,10" fill="#198a00" />
          <polygon points="270,0 520,0 540,10 250,10" fill="#DE2010" />
          <polygon points="520,0 760,0 740,10 540,10" fill="#000000" />
          <polygon points="760,0 1000,0 1000,10 740,10" fill="#FF6600" />
        </svg>
      </Box>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
        paddingX={theme.spacing(isMobile ? theme.tabiyaSpacing.xs : theme.tabiyaSpacing.md)}
        paddingY={theme.spacing(isMobile ? theme.tabiyaSpacing.sm : theme.tabiyaSpacing.md)}
        data-testid={DATA_TEST_ID.HEADER_CONTAINER}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <NavLink style={{ lineHeight: 0 }} to={routerPaths.ROOT} data-testid={DATA_TEST_ID.HEADER_LOGO_LINK}>
            <img
              src={logoSrc}
              alt={t("app.logoAlt")}
              height={12 * theme.tabiyaSpacing.xl}
              data-testid={DATA_TEST_ID.HEADER_LOGO}
              onError={() => {
                const darkFallback = `${process.env.PUBLIC_URL}/njila-logo-dark.svg`;
                setLogoSrc((prev) => (prev === darkFallback ? prev : darkFallback));
              }}
            />
          </NavLink>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: theme.spacing(theme.tabiyaSpacing.md) }}>
          <LanguageContextMenu removeMargin={true} />
          <PrimaryIconButton
            sx={{ color: theme.palette.common.black }}
            onClick={(event) => setAnchorEl(event.currentTarget)}
            data-testid={DATA_TEST_ID.HEADER_BUTTON_USER}
            title={t("header.user").toLowerCase()}
          >
            <img src={`${process.env.PUBLIC_URL}/user-icon.svg`} alt={t("header.user")} />
          </PrimaryIconButton>
        </Box>
        <ContextMenu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          notifyOnClose={() => setAnchorEl(null)}
          items={contextMenuItems}
        />
      </Box>
    </Box>
  );
};

export default Header;
