import { LanguageOutlined } from "@mui/icons-material";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import React, { useState } from "react";
import { useTheme } from "@mui/material";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import i18n from "src/i18n/i18n";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";

const uniqueId = "f4d06e4b-0e0c-49c7-ad93-924c5ac89070";

export const DATA_TEST_ID = {
  AUTH_LANGUAGE_SELECTOR_BUTTON: `auth-language-selector-${uniqueId}`,
  AUTH_ENGLISH_SELECTOR_BUTTON: `auth-english-selector-${uniqueId}`,
};

export const MENU_ITEM_ID = {
  AUTH_ENGLISH_SELECTOR: `english-selector-${uniqueId}`,
  AUTH_FRENCH_SELECTOR: `french-selector-${uniqueId}`,
};

export const MENU_ITEM_TEXT = {
  ENGLISH: `English`,
  FRENCH: `French`,
};

const LanguageContextMenu = () => {
  const theme = useTheme();
  const contextMenuItems: MenuItemConfig[] = [
    {
      id: MENU_ITEM_ID.AUTH_ENGLISH_SELECTOR,
      text: MENU_ITEM_TEXT.ENGLISH,
      disabled: false,
      action: () => i18n.changeLanguage(Language.en),
    },
    {
      id: MENU_ITEM_ID.AUTH_FRENCH_SELECTOR,
      text: MENU_ITEM_TEXT.FRENCH,
      disabled: false,
      action: () => i18n.changeLanguage(Language.fr),
    },
  ];

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return (
    <>
      <PrimaryIconButton
        sx={{
          color: theme.palette.common.black,
          alignSelf: "flex-start",
          justifySelf: "flex-end",
          margin: theme.tabiyaSpacing.lg,
        }}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        data-testid={DATA_TEST_ID.AUTH_LANGUAGE_SELECTOR_BUTTON}
        title={"Language Selector"}
      >
        <LanguageOutlined />
      </PrimaryIconButton>
      <ContextMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        notifyOnClose={() => setAnchorEl(null)}
        items={contextMenuItems}
      />
    </>
  );
};

export default LanguageContextMenu;
