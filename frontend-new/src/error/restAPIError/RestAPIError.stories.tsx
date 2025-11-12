import React from "react";

import type { Meta, StoryObj } from "@storybook/react";
import SnackbarProvider, { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { FormLabel, MenuItem, Select, Stack } from "@mui/material";
import ErrorConstants from "./RestAPIError.constants";
import i18n from "src/i18n/i18n";

const meta: Meta<typeof SnackbarProvider> = {
  title: "Error/Error",
  component: SnackbarProvider,
  tags: ["autodocs"],
  argTypes: {},
  parameters: {
    docs: { disable: true },
    a11y: {
      // Disabling a11y due to https://github.com/iamhosseindhv/notistack/issues/579
      // See also frontend/src/theme/SnackbarProvider/SnackbarProvider.tsx
      disable: true,
    },
  },
};

export default meta;

type Story = StoryObj<typeof SnackbarProvider>;

const TestErrorDropdown = () => {
  const { enqueueSnackbar } = useSnackbar();

  const handleSelect = (event: React.MouseEvent<HTMLLIElement>) => {
    const key = event.currentTarget.getAttribute("data-key") as keyof typeof ErrorConstants.USER_FRIENDLY_ERROR_MESSAGE_KEYS;
    if (!key) return;
    const message = i18n.t(ErrorConstants.USER_FRIENDLY_ERROR_MESSAGE_KEYS[key]);
    enqueueSnackbar(message, { variant: "error" });
  };

  return (
    <Stack width={"fit-content"}>
      <FormLabel>{i18n.t("error.restAPIError.storyChooseMessageLabel", { defaultValue: "Choose an error message to display in a notification:" })}</FormLabel>
      <Select value={""} displayEmpty renderValue={() => i18n.t("error.restAPIError.storySelectPlaceholder", { defaultValue: "Select an error message" })}>
        {Object.keys(ErrorConstants.USER_FRIENDLY_ERROR_MESSAGE_KEYS).map((key) => (
          <MenuItem onClick={handleSelect} key={key} data-key={key} value={key}>
            {key}
          </MenuItem>
        ))}
      </Select>
    </Stack>
  );
};

export const Shown: Story = {
  // exclude from a11y tests as this is for visual demonstration only
  parameters: { a11y: { disable: true } },
  render: () => <TestErrorDropdown />,
};
