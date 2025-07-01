import { ReactNode } from "react";

export type MenuItemConfig = {
  id: string;
  text: string;
  description?: string;
  icon?: ReactNode;
  disabled: boolean;
  action: () => void;
  textColor?: string;
};
