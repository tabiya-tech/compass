import { LanguageOutlined } from "@mui/icons-material";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";
import React, { useCallback, useMemo, useState } from "react";
import { useTheme } from "@mui/material";
import ContextMenu from "src/theme/ContextMenu/ContextMenu";
import { useTranslation } from "react-i18next";
import { Locale, LocalesLabels } from "src/i18n/constants";
import { parseEnvSupportedLocales } from "src/i18n/languageContextMenu/parseEnvSupportedLocales";

const uniqueId = "f4d06e4b-0e0c-49c7-ad93-924c5ac89070";

export const DATA_TEST_ID = {
  LANGUAGE_CONTEXT_MENU_SELECT_BUTTON: `language-context-menu-select-button-${uniqueId}`,
  LANGUAGE_CONTEXT_MENU_ITEM: `language-context-menu-${uniqueId}`,
};

export type LanguageContextMenuProps = {
  /** If true, removes the margin from the button to allow consistent spacing in different contexts */
  removeMargin?: boolean;
};

const LanguageContextMenu: React.FC<LanguageContextMenuProps> = ({ removeMargin = false }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const theme = useTheme();
  const { t, i18n } = useTranslation();

  const handleLocaleChange = useCallback(
    (locale: Locale) => () => {
      i18n
        .changeLanguage(locale)
        .then(() => {
          console.debug(`Language changed to ${locale}`);
        })
        .catch((e) => {
          console.error(`Failed to change language to ${locale}`, e);
        });
    },
    [i18n]
  );

  const supportedLocales = useMemo(() => parseEnvSupportedLocales(), []);

  const menuOptions = useMemo(() => {
    return supportedLocales.map((locale) => ({
      id: `${DATA_TEST_ID.LANGUAGE_CONTEXT_MENU_ITEM}-${locale}`,
      // TO FIX: proper translation of the text (CAI-119). use LocaleKeys.
      text: LocalesLabels[locale],
      disabled: false,
      action: handleLocaleChange(locale),
    }));
  }, [handleLocaleChange, supportedLocales]);

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
        data-testid={DATA_TEST_ID.LANGUAGE_CONTEXT_MENU_SELECT_BUTTON}
        title={t("i18n.languageContextMenu.selector")}
      >
        <LanguageOutlined />
      </PrimaryIconButton>

      <ContextMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        notifyOnClose={() => setAnchorEl(null)}
        items={menuOptions}
      />
    </>
  );
};

export default LanguageContextMenu;
