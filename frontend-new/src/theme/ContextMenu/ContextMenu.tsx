import { Box, Divider, Icon, ListItemIcon, ListItemText, Menu, MenuItem, Typography, useTheme } from "@mui/material";
import { MenuItemConfig } from "./menuItemConfig.types";

export interface ContextMenuProps {
  items: MenuItemConfig[];
  open: boolean;
  anchorEl: HTMLElement | null;
  notifyOnClose: () => void;
  headerMessage?: string;
}

const uniqueId = "b7499b01-8082-4209-8667-c7d559a70caf";
export const DATA_TEST_ID = {
  MENU: `${uniqueId}-menu`,
  MENU_ITEM: `${uniqueId}-menu-item`,
  MENU_ITEM_ICON: `${uniqueId}-menu-item-icon`,
  MENU_ITEM_TEXT: `${uniqueId}-menu-item-text`,
  MENU_HEADER_MESSAGE: `${uniqueId}-menu-header-message`,
};

function ContextMenu(props: Readonly<ContextMenuProps>) {
  const theme = useTheme();
  const handleItemClick = (item: MenuItemConfig) => {
    props.notifyOnClose();
    item.action();
  };

  return (
    <Menu
      elevation={2}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "center",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      anchorEl={props.anchorEl}
      open={props.open}
      onClose={props.notifyOnClose}
      data-testid={DATA_TEST_ID.MENU}
    >
      {props.headerMessage && (
        <Box>
          <Box
            sx={{
              maxWidth: 250,
              px: theme.fixedSpacing(theme.tabiyaSpacing.md),
              py: theme.fixedSpacing(theme.tabiyaSpacing.sm),
            }}
            data-testid={DATA_TEST_ID.MENU_HEADER_MESSAGE}
          >
            <Typography variant="caption" fontWeight="bold" color={theme.palette.text.secondary}>
              {props.headerMessage}
            </Typography>
          </Box>
          <Divider />
        </Box>
      )}
      {props.items.map((item) => (
        <MenuItem
          onClick={() => handleItemClick(item)}
          data-testid={DATA_TEST_ID.MENU_ITEM}
          disabled={item.disabled}
          key={item.id}
        >
          {item.icon && (
            <ListItemIcon data-testid={DATA_TEST_ID.MENU_ITEM_ICON}>
              <Icon sx={{ color: theme.palette.text.secondary }}>{item.icon}</Icon>
            </ListItemIcon>
          )}
          <ListItemText data-testid={DATA_TEST_ID.MENU_ITEM_TEXT}>
            <Typography variant="caption" color={item.textColor ?? "secondary"}>
              {item.text}
            </Typography>
            {item.description && (
              <Typography variant="caption" display="flex" whiteSpace="normal">
                {item.description}
              </Typography>
            )}
          </ListItemText>
        </MenuItem>
      ))}
    </Menu>
  );
}

export default ContextMenu;
