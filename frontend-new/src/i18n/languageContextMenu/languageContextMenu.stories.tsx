import { Meta, StoryObj } from "@storybook/react";
import LanguageContextMenu from "./LanguageContextMenu";
import { useTranslation } from "react-i18next";
import { Box, Card, CardContent } from "@mui/material";

const meta: Meta<typeof LanguageContextMenu> = {
  title: "I18n/LanguageContextMenu",
  tags: ["autodocs"],
  component: LanguageContextMenu,
};

export default meta;

const LanguageContextMenuShowCase = () => {
  const { t } = useTranslation();
  return (
    <Card sx={{ margin: 30 }}>
      <CardContent>
        <Box>
          <LanguageContextMenu removeMargin={true} />
          <p>{t("auth.pages.landing.subtitleBody")}</p>
        </Box>
      </CardContent>
    </Card>
  );
};

export const Shown: StoryObj<typeof LanguageContextMenu> = {
  render: () => <LanguageContextMenuShowCase />,
};
