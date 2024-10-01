import React, { useMemo, useState } from "react";

import { IconButton, InputAdornment, TextFieldProps, TextField } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

type PasswordInputProps = Omit<TextFieldProps, "type"> & {
  showPassword?: boolean;
};

const uniqueId = "b7499b01-8082-4209-8667-c7d559a70cag";
export const DATA_TEST_ID = {
  TEXT_FIELD: `${uniqueId}-text-field`,
  TEXT_FIELD_INPUT: `${uniqueId}-custom-text-field-input`,
  ICON_BUTTON: `${uniqueId}-icon-button`,
  VISIBILITY_ON_ICON: `${uniqueId}-visibility-on-icon`,
  VISIBILITY_OFF_ICON: `${uniqueId}-visibility-off-icon`,
};

const PasswordInput: React.FC<Readonly<PasswordInputProps>> = ({ showPassword: _showPassword, ...props }) => {
  const [showPassword, setShowPassword] = useState(_showPassword);

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const type = useMemo(() => (showPassword ? "text" : "password"), [showPassword]);

  return (
    <TextField
      {...props}
      type={type}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label="toggle password visibility"
              edge="end"
              data-testid={DATA_TEST_ID.ICON_BUTTON}
              onClick={handleClickShowPassword}
              disabled={props.disabled}
            >
              {showPassword ? (
                <VisibilityOff data-testid={DATA_TEST_ID.VISIBILITY_OFF_ICON} />
              ) : (
                <Visibility data-testid={DATA_TEST_ID.VISIBILITY_ON_ICON} />
              )}
            </IconButton>
          </InputAdornment>
        ),
        inputProps: { "data-testid": props?.inputProps?.["data-testid"] || DATA_TEST_ID.TEXT_FIELD_INPUT },
      }}
    />
  );
};

export default PasswordInput;
