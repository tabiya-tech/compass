import {
  Box,
  Divider,
  Icon,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  PopoverOrigin,
  SxProps,
  Typography,
  useTheme,
} from "@mui/material";
import { MenuItemConfig } from "./menuItemConfig.types";
import { Theme } from "@mui/material/styles";

export interface ContextMenuProps {
  items: MenuItemConfig[];
  open: boolean;
  anchorEl: HTMLElement | null;
  notifyOnClose: () => void;
  headerMessage?: string;
  anchorOrigin?: PopoverOrigin;
  transformOrigin?: PopoverOrigin;
  paperSx?: SxProps<Theme>;
}

const uniqueId = "b7499b01-8082-4209-8667-c7d559a70caf";
export const DATA_TEST_ID = {
  MENU: `${uniqueId}-menu`,
  MENU_ITEM: `${uniqueId}-menu-item`,
  MENU_ITEM_ICON: `${uniqueId}-menu-item-icon`,
  MENU_ITEM_TRAILING_ICON: `${uniqueId}-menu-item-trailing-icon`,
  MENU_ITEM_TEXT: `${uniqueId}-menu-item-text`,
  MENU_HEADER_MESSAGE: `${uniqueId}-menu-header-message`,
  CUSTOM_MENU_ITEM: `${uniqueId}-custom-menu-item`,
};

function ContextMenu(props: Readonly<ContextMenuProps>) {
  const theme = useTheme();
  const handleItemClick = (item: MenuItemConfig) => {
    if (item.closeMenuOnClick !== false) {
      props.notifyOnClose();
    }
    item.action();
  };

  return (
    <Menu
      elevation={2}
      anchorOrigin={props.anchorOrigin ?? { vertical: "bottom", horizontal: "center" }}
      transformOrigin={props.transformOrigin ?? { vertical: "top", horizontal: "right" }}
      anchorEl={props.anchorEl}
      open={props.open}
      disableAutoFocusItem
      onClose={props.notifyOnClose}
      data-testid={DATA_TEST_ID.MENU}
      slotProps={{
        paper: { sx: props.paperSx },
      }}
    >
      {props.headerMessage && (
        <Box>
          <Box
            sx={{
              maxWidth: 300,
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
      {props.items.map((item) => {
        if (item.customNode) {
          // Wrap custom content in a MenuItem to keep it inside MenuList
          return (
            <MenuItem
              key={item.id}
              disabled={item.disabled}
              disableGutters
              disableRipple
              data-testid={DATA_TEST_ID.CUSTOM_MENU_ITEM}
              sx={{
                "&:hover": { backgroundColor: "transparent" },
              }}
            >
              <Box sx={{ width: "100%" }}>{item.customNode}</Box>
            </MenuItem>
          );
        }

        return (
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
            {item.trailingIcon && (
              <ListItemIcon data-testid={DATA_TEST_ID.MENU_ITEM_TRAILING_ICON} sx={{ justifyContent: "flex-end" }}>
                <Icon sx={{ color: theme.palette.text.secondary }}>{item.trailingIcon}</Icon>
              </ListItemIcon>
            )}
          </MenuItem>
        );
      })}
    </Menu>
  );
}

export default ContextMenu;
