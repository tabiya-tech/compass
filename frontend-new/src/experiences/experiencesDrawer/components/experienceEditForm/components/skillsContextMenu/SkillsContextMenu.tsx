import { Box, Divider, ListItemText, Menu, MenuItem, Typography, useMediaQuery, useTheme } from "@mui/material";
import { MenuItemConfig } from "src/theme/ContextMenu/menuItemConfig.types";
import React from "react";

export interface SkillsContextMenuProps {
  items: MenuItemConfig[];
  open: boolean;
  anchorEl: HTMLElement | null;
  notifyOnClose: () => void;
}

const uniqueId = "54bb15e1-a83f-49f8-84e1-8158ef7b2ec1";
export const DATA_TEST_ID = {
  SKILL_MENU: `${uniqueId}-skill-menu`,
  SKILL_MENU_ITEM: `${uniqueId}-skill-menu-item`,
  SKILL_MENU_ITEM_TEXT: `${uniqueId}-skill-menu-item-text`,
  SKILL_MENU_ITEM_DESCRIPTION: `${uniqueId}-skill-menu-item-description`,
  SKILL_MENU_HEADER_MESSAGE: `${uniqueId}-skill-menu-header-message`,
};

const SkillsContextMenu: React.FC<Readonly<SkillsContextMenuProps>> = (props) => {
  const theme = useTheme();
  const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const handleItemClick = (item: MenuItemConfig) => {
    props.notifyOnClose();
    item.action();
  };

  return (
    <Menu
      elevation={2}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      transformOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      anchorEl={props.anchorEl}
      open={props.open}
      onClose={props.notifyOnClose}
      data-testid={DATA_TEST_ID.SKILL_MENU}
      slotProps={{
        paper: {
          sx: {
            width: isMobile ? "100%" : "60%",
            overflow: "hidden",
          },
        },
      }}
      MenuListProps={{
        sx: {
          paddingTop: 0,
        },
      }}
    >
      <Box
        position="sticky"
        top={0}
        bgcolor={theme.palette.background.paper}
        paddingX={theme.fixedSpacing(theme.tabiyaSpacing.md)}
        paddingTop={theme.fixedSpacing(theme.tabiyaSpacing.md)}
        width="100%"
        zIndex={1}
      >
        <Typography
          variant="caption"
          fontWeight="bold"
          color={theme.palette.text.secondary}
          data-testid={DATA_TEST_ID.SKILL_MENU_HEADER_MESSAGE}
        >
          These skills were identified by Compass but are considered less relevant to your experience
        </Typography>
        <Divider sx={{ paddingTop: theme.fixedSpacing(theme.tabiyaSpacing.sm) }} />
      </Box>
      <Box
        sx={{
          maxHeight: isSmallMobile ? "80vh" : "60vh",
          overflowY: "scroll",
          overflowX: "hidden",
          "&::-webkit-scrollbar": {
            width: theme.fixedSpacing(theme.tabiyaSpacing.sm),
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: theme.palette.primary.main,
            borderRadius: theme.fixedSpacing(theme.tabiyaSpacing.xs),
          },
          paddingTop: theme.fixedSpacing(theme.tabiyaSpacing.sm),
        }}
      >
        {props.items.map((item) => (
          <MenuItem
            onClick={() => handleItemClick(item)}
            data-testid={DATA_TEST_ID.SKILL_MENU_ITEM}
            disabled={item.disabled}
            key={item.id}
          >
            <ListItemText>
              <Typography
                whiteSpace="normal"
                variant="caption"
                color={item.textColor ?? "secondary"}
                data-testid={DATA_TEST_ID.SKILL_MENU_ITEM_TEXT}
              >
                {item.text}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  width: "100%",
                  textOverflow: "ellipsis",
                  whiteSpace: "normal",
                }}
                data-testid={DATA_TEST_ID.SKILL_MENU_ITEM_DESCRIPTION}
              >
                {item.description}
              </Typography>
            </ListItemText>
          </MenuItem>
        ))}
      </Box>
    </Menu>
  );
};

export default SkillsContextMenu;
