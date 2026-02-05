import React from "react";

import type { Meta, StoryObj } from "@storybook/react";
import SnackbarProvider, { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { FormLabel, MenuItem, Select, Stack } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import ErrorConstants from "./RestAPIError.constants";
import { translateUserFriendlyErrorMessage } from "src/error/restAPIError/RestAPIError";

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

type ErrorKey = keyof typeof ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS;

const TestErrorDropdown = () => {
  const { enqueueSnackbar } = useSnackbar();
  const t = translateUserFriendlyErrorMessage;

  const [selectedKey, setSelectedKey] = React.useState<ErrorKey | "">("");

  const handleChange = (event: SelectChangeEvent<ErrorKey | "">) => {
    const key = event.target.value;
    setSelectedKey(key);

    if (!key) return;

    const i18nKey = ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS[key];
    enqueueSnackbar(t(i18nKey), { variant: "error" });
  };

  return (
    <Stack width={"fit-content"}>
      <FormLabel> Choose an error message to display in a notification:</FormLabel>
      <Select
        value={selectedKey}
        onChange={handleChange}
        displayEmpty
        renderValue={(value) => value || "Select an error message"}
      >
        <MenuItem value="" disabled>
          Select an error message
        </MenuItem>

        {Object.keys(ErrorConstants.USER_FRIENDLY_ERROR_I18N_KEYS).map((key) => (
          <MenuItem key={key} value={key}>
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
