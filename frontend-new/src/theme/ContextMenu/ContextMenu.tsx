import {
  Box,
  Divider,
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
      elevation={3}
      anchorOrigin={props.anchorOrigin ?? { vertical: "bottom", horizontal: "center" }}
      transformOrigin={props.transformOrigin ?? { vertical: "top", horizontal: "right" }}
      anchorEl={props.anchorEl}
      open={props.open}
      disableAutoFocusItem
      onClose={props.notifyOnClose}
      data-testid={DATA_TEST_ID.MENU}
      slotProps={{
        paper: {
          sx: {
            borderRadius: "16px",
            minWidth: 160,
            maxWidth: 200,
            p: theme.fixedSpacing(theme.tabiyaSpacing.sm),
            ...props.paperSx,
          },
        },
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
            <Typography variant="caption" fontWeight="bold" color={theme.palette.text.primary}>
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
            sx={{
              borderRadius: theme.tabiyaRounding.sm,
              py: { xs: theme.fixedSpacing(theme.tabiyaSpacing.xs), sm: theme.fixedSpacing(theme.tabiyaSpacing.sm) },
              px: theme.fixedSpacing(theme.tabiyaSpacing.md),
              gap: theme.fixedSpacing(theme.tabiyaSpacing.md),
              "&:hover": { backgroundColor: theme.palette.action.hover },
              "& .MuiListItemIcon-root": { minWidth: "unset" },
            }}
          >
            {item.icon && (
              <ListItemIcon data-testid={DATA_TEST_ID.MENU_ITEM_ICON} sx={{ color: theme.palette.text.primary }}>
                {item.icon}
              </ListItemIcon>
            )}
            <ListItemText data-testid={DATA_TEST_ID.MENU_ITEM_TEXT}>
              <Typography variant="body2" color={item.textColor ?? "text.primary"} fontWeight={500}>
                {item.text}
              </Typography>
              {item.description && (
                <Typography variant="caption" display="flex" whiteSpace="normal">
                  {item.description}
                </Typography>
              )}
            </ListItemText>
            {item.trailingIcon && (
              <ListItemIcon
                data-testid={DATA_TEST_ID.MENU_ITEM_TRAILING_ICON}
                sx={{ justifyContent: "flex-end", minWidth: "unset", color: theme.palette.text.primary }}
              >
                {item.trailingIcon}
              </ListItemIcon>
            )}
          </MenuItem>
        );
      })}
    </Menu>
  );
}

export default ContextMenu;
