import React, { useCallback, useContext, useMemo, useState, startTransition } from "react";
import { Avatar, Box, Typography, useTheme, useMediaQuery } from "@mui/material";
import type { PaletteColor, Theme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { routerPaths } from "src/app/routerPaths";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import AuthenticationServiceFactory from "src/auth/services/Authentication.service.factory";
import { getAppIconUrl } from "src/envService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { useTranslation } from "react-i18next";
import type { TranslationKey } from "src/react-i18next";
import {
  Search,
  LayoutDashboard,
  BookOpenText,
  Globe,
  Menu,
  ChevronRight,
  CircleUser,
  FileText,
  Bug,
  LogOut,
  UserPlus,
} from "lucide-react";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import AnonymousAccountConversionDialog from "src/auth/components/anonymousAccountConversionDialog/AnonymousAccountConversionDialog";
import TextConfirmModalDialog from "src/theme/textConfirmModalDialog/TextConfirmModalDialog";
import { HighlightedSpan } from "src/consent/components/consentPage/Consent";
import { Backdrop } from "src/theme/Backdrop/Backdrop";
import { useSentryFeedbackForm } from "src/feedback/hooks/useSentryFeedbackForm";
import { parseEnvSupportedLocales } from "src/i18n/languageContextMenu/parseEnvSupportedLocales";
import { LocalesLabels } from "src/i18n/constants";
import { useExperiencesDrawer } from "src/experiences/ExperiencesDrawerProvider";
import { useUserProfileContext } from "src/profile/UserProfileContext";

const uniqueId = "c3a8f1d2-7b4e-4c9a-a5d6-8e3f2b1c0d9e";

const IS_NAV_SEARCH_DISABLED = true;

export const DATA_TEST_ID = {
  NAVBAR_CONTAINER: `navbar-container-${uniqueId}`,
  NAVBAR_LOGO: `navbar-logo-${uniqueId}`,
  NAVBAR_LOGO_LINK: `navbar-logo-link-${uniqueId}`,
  NAVBAR_LINK_SEARCH: `navbar-link-search-${uniqueId}`,
  NAVBAR_LINK_DASHBOARD: `navbar-link-dashboard-${uniqueId}`,
  NAVBAR_LINK_PATHWAYS: `navbar-link-pathways-${uniqueId}`,
  NAVBAR_LANGUAGE_BUTTON: `navbar-language-button-${uniqueId}`,
  NAVBAR_USER_NAME: `navbar-user-name-${uniqueId}`,
  NAVBAR_USER_AVATAR: `navbar-user-avatar-${uniqueId}`,
  NAVBAR_BUTTON_MENU: `navbar-button-menu-${uniqueId}`,
};

export const MENU_ITEM_ID = {
  LOGOUT_BUTTON: `navbar-logout-button-${uniqueId}`,
  REPORT_BUG_BUTTON: `navbar-report-bug-button-${uniqueId}`,
  REGISTER: `navbar-register-${uniqueId}`,
  VIEW_PROFILE: `navbar-view-profile-${uniqueId}`,
  VIEW_EXPERIENCES: `navbar-view-experiences-${uniqueId}`,
  PATHWAYS: `navbar-mobile-pathways-${uniqueId}`,
  MOBILE_LANGUAGE: `navbar-mobile-language-${uniqueId}`,
};

export interface NavBarProps {
  headerColor?: string;
}

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const NavBar: React.FC<NavBarProps> = ({ headerColor = "brandAction" }) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const { enqueueSnackbar } = useSnackbar();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [languageSubmenuAnchorEl, setLanguageSubmenuAnchorEl] = useState<HTMLElement | null>(null);
  const [languageAnchorEl, setLanguageAnchorEl] = useState<HTMLElement | null>(null);
  const [showConversionDialog, setShowConversionDialog] = useState(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const isOnline = useContext(IsOnlineContext);
  const { sentryEnabled, openFeedbackForm } = useSentryFeedbackForm();
  const { openExperiencesDrawer } = useExperiencesDrawer();

  const user = authenticationStateService.getInstance().getUser();
  const isAnonymous = !user?.name || !user?.email;
  const { profileData } = useUserProfileContext();
  const userName = profileData.name || "";

  const paletteColor = theme.palette[headerColor as keyof typeof theme.palette] as PaletteColor;
  const bgColor = paletteColor?.main ?? theme.palette.brandAction.main;
  const textColor = paletteColor?.contrastText ?? theme.palette.brandAction.contrastText;

  const logoUrlFromEnv = getAppIconUrl();
  const logoSrc = logoUrlFromEnv || `${process.env.PUBLIC_URL}/njila_logo.svg`;

  const currentLocale = i18n.language?.split("-")[0]?.toUpperCase() || "EN";

  const currentPath = location.pathname;
  const isOnDashboard = currentPath === "/" || currentPath === "";
  const isOnPathways = currentPath.startsWith(routerPaths.KNOWLEDGE_HUB);

  const handleReportBug = useCallback(() => {
    void openFeedbackForm();
  }, [openFeedbackForm]);

  const handleLogout = useCallback(async () => {
    if (isAnonymous) {
      setShowLogoutConfirmation(true);
    } else {
      setIsLoggingOut(true);
      const authenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
      await authenticationService!.logout();
      navigate(routerPaths.LOGIN, { replace: true });
      enqueueSnackbar(t("chat.chat.notifications.logoutSuccess"), { variant: "success" });
      setIsLoggingOut(false);
    }
  }, [isAnonymous, enqueueSnackbar, navigate, t]);

  const handleConfirmLogout = useCallback(async () => {
    setShowLogoutConfirmation(false);
    setIsLoggingOut(true);
    const authenticationService = AuthenticationServiceFactory.getCurrentAuthenticationService();
    await authenticationService!.logout();
    navigate(routerPaths.LOGIN, { replace: true });
    enqueueSnackbar(t("chat.chat.notifications.logoutSuccess"), { variant: "success" });
    setIsLoggingOut(false);
  }, [enqueueSnackbar, navigate, t]);

  const handleRegister = useCallback(() => {
    setShowLogoutConfirmation(false);
    setShowConversionDialog(true);
  }, []);

  const navigateToProfile = useCallback(() => {
    startTransition(() => {
      setAnchorEl(null);
      navigate(routerPaths.PROFILE);
    });
  }, [navigate]);

  const navigateWithTransition = useCallback(
    (path: string) => {
      startTransition(() => {
        navigate(path);
      });
    },
    [navigate]
  );

  const navigateToPathways = useCallback(() => {
    setAnchorEl(null);
    navigateWithTransition(routerPaths.KNOWLEDGE_HUB);
  }, [navigateWithTransition]);

  const handleViewExperiences = useCallback(() => {
    setAnchorEl(null);
    openExperiencesDrawer();
  }, [openExperiencesDrawer]);

  const contextMenuItems: MenuItemConfig[] = useMemo(
    () => [
      {
        id: MENU_ITEM_ID.VIEW_PROFILE,
        text: t("chat.chatHeader.viewMyProfile"),
        icon: <CircleUser size={18} />,
        disabled: false,
        action: navigateToProfile,
      },
      {
        id: MENU_ITEM_ID.VIEW_EXPERIENCES,
        text: t("chat.chatHeader.viewExperiences"),
        icon: <FileText size={18} />,
        disabled: !isOnline,
        action: handleViewExperiences,
      },
      {
        id: MENU_ITEM_ID.REPORT_BUG_BUTTON,
        text: t("feedback.bugReport.reportBug"),
        icon: <Bug size={18} />,
        disabled: !isOnline || !sentryEnabled,
        action: handleReportBug,
      },
      ...(isAnonymous
        ? [
            {
              id: MENU_ITEM_ID.REGISTER,
              text: t("common.buttons.register"),
              icon: <UserPlus size={18} />,
              disabled: !isOnline,
              action: handleRegister,
            },
          ]
        : []),
      {
        id: MENU_ITEM_ID.LOGOUT_BUTTON,
        text: t("common.buttons.logout"),
        icon: <LogOut size={18} />,
        disabled: !isOnline,
        action: () => {
          void handleLogout();
        },
      },
    ],
    [
      t,
      sentryEnabled,
      isOnline,
      handleReportBug,
      isAnonymous,
      handleRegister,
      handleLogout,
      navigateToProfile,
      handleViewExperiences,
    ]
  );

  const supportedLocales = useMemo(() => parseEnvSupportedLocales(), []);
  const hasMultipleLocales = supportedLocales.length > 1;

  const localeMenuItems: MenuItemConfig[] = useMemo(
    () =>
      supportedLocales.map((locale) => ({
        id: `locale-${locale}`,
        text: LocalesLabels[locale],
        disabled: false,
        action: () => {
          void i18n.changeLanguage(locale);
          setLanguageAnchorEl(null);
          setAnchorEl(null);
          setLanguageSubmenuAnchorEl(null);
        },
      })),
    [supportedLocales, i18n]
  );

  const mobileMenuItems: MenuItemConfig[] = useMemo(() => {
    const baseItems: MenuItemConfig[] = [
      {
        id: MENU_ITEM_ID.VIEW_PROFILE,
        text: t("chat.chatHeader.viewMyProfile").toLowerCase(),
        icon: <CircleUser size={18} />,
        disabled: false,
        action: navigateToProfile,
      },
      {
        id: MENU_ITEM_ID.VIEW_EXPERIENCES,
        text: t("chat.chatHeader.viewExperiences").toLowerCase(),
        icon: <FileText size={18} />,
        disabled: !isOnline,
        action: handleViewExperiences,
      },
      {
        id: MENU_ITEM_ID.PATHWAYS,
        text: t("nav.pathways" as TranslationKey).toLowerCase(),
        icon: <BookOpenText size={18} />,
        disabled: false,
        action: navigateToPathways,
      },
      ...(hasMultipleLocales
        ? [
            {
              id: MENU_ITEM_ID.MOBILE_LANGUAGE,
              text: t("i18n.languageContextMenu.selector" as TranslationKey).toLowerCase(),
              icon: <Globe size={18} />,
              disabled: false,
              action: () => {
                setLanguageSubmenuAnchorEl(anchorEl);
              },
              closeMenuOnClick: false,
              trailingIcon: <ChevronRight size={18} />,
            },
          ]
        : []),
      ...(sentryEnabled
        ? [
            {
              id: MENU_ITEM_ID.REPORT_BUG_BUTTON,
              text: t("feedback.bugReport.reportBug").toLowerCase(),
              icon: <Bug size={18} />,
              disabled: !isOnline,
              action: handleReportBug,
            },
          ]
        : []),
      ...(isAnonymous
        ? [
            {
              id: MENU_ITEM_ID.REGISTER,
              text: t("common.buttons.register").toLowerCase(),
              icon: <UserPlus size={18} />,
              disabled: !isOnline,
              action: handleRegister,
            },
          ]
        : []),
      {
        id: MENU_ITEM_ID.LOGOUT_BUTTON,
        text: t("common.buttons.logout").toLowerCase(),
        icon: <LogOut size={18} />,
        disabled: !isOnline,
        action: () => {
          void handleLogout();
        },
      },
    ];
    return baseItems;
  }, [
    t,
    isOnline,
    navigateToProfile,
    handleViewExperiences,
    navigateToPathways,
    sentryEnabled,
    handleReportBug,
    isAnonymous,
    handleRegister,
    anchorEl,
    handleLogout,
    hasMultipleLocales,
  ]);

  const getNavLinkSx = (isActive: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    color: textColor,
    textDecoration: "none",
    fontSize: "0.875rem",
    fontWeight: isActive ? 700 : 400,
    opacity: isActive ? 0.6 : 1,
    px: 1,
    py: 0.5,
    borderRadius: "6px",
    "&:hover": { opacity: 0.8 },
  });

  return (
    <Box
      sx={{
        backgroundColor: bgColor,
        color: textColor,
        borderTop: `1px solid ${theme.palette.common.white}33`,
        position: "sticky",
        top: 0,
        zIndex: theme.zIndex.appBar,
      }}
      data-testid={DATA_TEST_ID.NAVBAR_CONTAINER}
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)}
        width="100%"
        paddingX="var(--layout-gutter-x)"
        paddingY={theme.spacing(theme.tabiyaSpacing.sm)}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <NavLink
            style={{ lineHeight: 0 }}
            to={routerPaths.ROOT}
            onClick={(event) => {
              event.preventDefault();
              navigateWithTransition(routerPaths.ROOT);
            }}
            data-testid={DATA_TEST_ID.NAVBAR_LOGO_LINK}
          >
            <img src={logoSrc} alt={t("app.compassLogoAlt")} height={28} data-testid={DATA_TEST_ID.NAVBAR_LOGO} />
          </NavLink>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: isMobile ? 1 : 2 }}>
          {isMobile ? (
            <PrimaryIconButton
              color="inherit"
              onClick={(event) => setAnchorEl(event.currentTarget)}
              data-testid={DATA_TEST_ID.NAVBAR_BUTTON_MENU}
              title={t("chat.chatHeader.userInfo").toLowerCase()}
              sx={{
                color: textColor,
                "&&:hover": {
                  backgroundColor: alpha(theme.palette.common.white, 0.16),
                  color: textColor,
                },
              }}
            >
              <Menu size={20} />
            </PrimaryIconButton>
          ) : (
            <>
              {IS_NAV_SEARCH_DISABLED ? (
                <Box
                  component="span"
                  aria-disabled
                  sx={{
                    ...getNavLinkSx(false),
                    opacity: 0.45,
                    cursor: "not-allowed",
                    pointerEvents: "none",
                    "&:hover": { opacity: 0.45 },
                  }}
                  data-testid={DATA_TEST_ID.NAVBAR_LINK_SEARCH}
                >
                  <Search size={18} />
                  {t("nav.search" as TranslationKey)}
                </Box>
              ) : (
                <Box
                  component={NavLink}
                  to={routerPaths.ROOT}
                  end
                  sx={getNavLinkSx(false)}
                  data-testid={DATA_TEST_ID.NAVBAR_LINK_SEARCH}
                >
                  <Search size={18} />
                  {t("nav.search" as TranslationKey)}
                </Box>
              )}
              <Box
                component={NavLink}
                to={routerPaths.ROOT}
                end
                onClick={(event: React.MouseEvent<HTMLElement>) => {
                  event.preventDefault();
                  navigateWithTransition(routerPaths.ROOT);
                }}
                sx={getNavLinkSx(isOnDashboard)}
                data-testid={DATA_TEST_ID.NAVBAR_LINK_DASHBOARD}
              >
                <LayoutDashboard size={18} />
                {t("nav.dashboard" as TranslationKey)}
              </Box>
              <Box
                component={NavLink}
                to={routerPaths.KNOWLEDGE_HUB}
                onClick={(event: React.MouseEvent<HTMLElement>) => {
                  event.preventDefault();
                  navigateWithTransition(routerPaths.KNOWLEDGE_HUB);
                }}
                sx={getNavLinkSx(isOnPathways)}
                data-testid={DATA_TEST_ID.NAVBAR_LINK_PATHWAYS}
              >
                <BookOpenText size={18} />
                {t("nav.pathways" as TranslationKey)}
              </Box>

              {hasMultipleLocales && (
                <Box
                  sx={{ ...getNavLinkSx(false), cursor: "pointer" }}
                  onClick={(event: React.MouseEvent<HTMLElement>) => setLanguageAnchorEl(event.currentTarget)}
                  data-testid={DATA_TEST_ID.NAVBAR_LANGUAGE_BUTTON}
                >
                  <Globe size={18} />
                  {currentLocale}
                </Box>
              )}

              <Box sx={{ width: "1px", height: 20, backgroundColor: textColor, opacity: 0.3, mx: 0.5 }} />

              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }}
                onClick={(event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: textColor,
                    fontWeight: 500,
                    whiteSpace: "normal",
                    textAlign: "right",
                    wordBreak: "break-word",
                  }}
                  data-testid={DATA_TEST_ID.NAVBAR_USER_NAME}
                >
                  {userName || t("chat.chatHeader.userInfo")}
                </Typography>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    backgroundColor: theme.palette.common.white,
                    color: bgColor,
                  }}
                  data-testid={DATA_TEST_ID.NAVBAR_USER_AVATAR}
                >
                  {userName ? getInitials(userName) : "?"}
                </Avatar>
              </Box>
            </>
          )}
        </Box>
      </Box>

      <ContextMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        notifyOnClose={() => {
          setAnchorEl(null);
          setLanguageSubmenuAnchorEl(null);
        }}
        items={isMobile ? mobileMenuItems : contextMenuItems}
      />
      <ContextMenu
        anchorEl={languageSubmenuAnchorEl}
        open={Boolean(languageSubmenuAnchorEl)}
        notifyOnClose={() => setLanguageSubmenuAnchorEl(null)}
        items={localeMenuItems}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        paperSx={{ maxHeight: 320 }}
      />
      <ContextMenu
        anchorEl={languageAnchorEl}
        open={Boolean(languageAnchorEl)}
        notifyOnClose={() => setLanguageAnchorEl(null)}
        items={localeMenuItems}
      />

      <AnonymousAccountConversionDialog
        isOpen={showConversionDialog}
        onClose={() => setShowConversionDialog(false)}
        onSuccess={() => {
          PersistentStorageService.setAccountConverted(true);
        }}
      />
      <TextConfirmModalDialog
        isOpen={showLogoutConfirmation}
        onCancel={handleConfirmLogout}
        onDismiss={() => setShowLogoutConfirmation(false)}
        onConfirm={handleRegister}
        title={t("chat.chatHeader.beforeYouGo")}
        confirmButtonText={t("common.buttons.register")}
        cancelButtonText={t("common.buttons.logout")}
        showCloseIcon={true}
        textParagraphs={[
          {
            id: "1",
            text: <>{t("chat.chatHeader.logoutConfirmationMessage")}</>,
          },
          {
            id: "2",
            text: (
              <>
                {t("chat.chatHeader.anonymousAccountWarning")}
                <HighlightedSpan> {t("chat.chatHeader.logoutWarningAnonymous")}</HighlightedSpan>.
              </>
            ),
          },
          {
            id: "3",
            text: (
              <>
                <HighlightedSpan>{t("chat.chatHeader.createAccountToSaveProgress")}</HighlightedSpan>{" "}
                {t("chat.chatHeader.continueYourJourneyLater")}
              </>
            ),
          },
        ]}
      />

      {isLoggingOut && <Backdrop isShown={isLoggingOut} message={t("chat.chat.backdrop.loggingOut")} />}
    </Box>
  );
};

export default NavBar;
