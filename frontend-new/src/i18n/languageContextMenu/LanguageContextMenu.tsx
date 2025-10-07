import { LanguageOutlined } from "@mui/icons-material";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import React, { useState } from "react";
import { useTheme } from "@mui/material";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { useTranslation } from "react-i18next";
import { getSupportedLocales } from "src/envService";
import { Locale } from "src/i18n/constants";

const uniqueId = "f4d06e4b-0e0c-49c7-ad93-924c5ac89070";

export const DATA_TEST_ID = {
  AUTH_LANGUAGE_SELECTOR_BUTTON: `auth-language-selector-${uniqueId}`,
  AUTH_ENGLISH_SELECTOR_BUTTON: `auth-english-selector-${uniqueId}`,
  AUTH_SPANISH_SELECTOR_BUTTON: `auth-spanish-selector-${uniqueId}`,
  AUTH_FRENCH_SELECTOR_BUTTON: `auth-french-selector-${uniqueId}`,
};

export const MENU_ITEM_ID = {
  AUTH_ENGLISH_SELECTOR: `english-selector-${uniqueId}`,
  AUTH_SPANISH_SELECTOR: `spanish-selector-${uniqueId}`,
  AUTH_FRENCH_SELECTOR: `french-selector-${uniqueId}`,
};

export const MENU_ITEM_TEXT = {
  ENGLISH: `English`,
  SPANISH: `Spanish`,
  SPANISH_ARGENTINA: `Spanish`,
  FRENCH: `French`,
};

export type LanguageContextMenuProps = {
  /** If true, removes the margin from the button to allow consistent spacing in different contexts */
  removeMargin?: boolean;
};

const LanguageContextMenu: React.FC<LanguageContextMenuProps> = ({ removeMargin = false }) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();

  // --- Parse supported languages from environment config
  let supportedLanguages: string[] = [];
  try {
    const configJson = getSupportedLocales();
    if (configJson) {
      supportedLanguages = JSON.parse(configJson);
    } else {
      console.log("Language config not available, reverting to default.");
    }
  } catch (e) {
    console.error("Error parsing language config JSON:", e);
  }

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // --- Define all possible menu items
  const allMenuItems: MenuItemConfig[] = [
    {
      id: MENU_ITEM_ID.AUTH_ENGLISH_SELECTOR,
      text: MENU_ITEM_TEXT.ENGLISH,
      disabled: !supportedLanguages.includes(Locale.EN_GB),
      action: () => changeLanguage(Locale.EN_GB),
    },
    {
      id: MENU_ITEM_ID.AUTH_ENGLISH_SELECTOR + "-ar",
      text: MENU_ITEM_TEXT.ENGLISH,
      disabled: !supportedLanguages.includes(Locale.EN_US),
      action: () => changeLanguage(Locale.EN_US),
    },
    {
      id: MENU_ITEM_ID.AUTH_SPANISH_SELECTOR,
      text: MENU_ITEM_TEXT.SPANISH,
      disabled: !supportedLanguages.includes(Locale.ES_ES),
      action: () => changeLanguage(Locale.ES_ES),
    },
    {
      id: MENU_ITEM_ID.AUTH_SPANISH_SELECTOR + "-ar",
      text: MENU_ITEM_TEXT.SPANISH_ARGENTINA,
      disabled: !supportedLanguages.includes(Locale.ES_AR),
      action: () => changeLanguage(Locale.ES_AR),
    }
  ];

  // --- Filter out languages that are disabled
  let visibleMenuItems = allMenuItems.filter(item => !item.disabled);

  // --- Ensure at least English is included if nothing is present
  if (visibleMenuItems.length === 0) {
    const englishItem = allMenuItems.find(item => item.text === MENU_ITEM_TEXT.ENGLISH);
    if (englishItem) visibleMenuItems = [englishItem];
  }

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <PrimaryIconButton
        sx={{
          color: theme.palette.common.black,
          alignSelf: "flex-start",
          justifySelf: "flex-end",
          margin: removeMargin ? 0 : theme.tabiyaSpacing.lg,
        }}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        data-testid={DATA_TEST_ID.AUTH_LANGUAGE_SELECTOR_BUTTON}
        title={t("i18n.languageContextMenu.selector")}
      >
        <LanguageOutlined />
      </PrimaryIconButton>

      <ContextMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        notifyOnClose={() => setAnchorEl(null)}
        items={visibleMenuItems}
      />
    </>
  );
};

export default LanguageContextMenu;
