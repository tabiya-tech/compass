import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconButton, InputAdornment, TextField, TextFieldProps } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { validatePassword } from "src/theme/PasswordInput/utils/validatePassword";
import PasswordRequirements from "src/theme/PasswordInput/PasswordRequirements/PasswordRequirements";

type PasswordInputProps = Omit<TextFieldProps, "type" | "helperText"> & {
  showPassword?: boolean;
  onValidityChange?: (isValid: boolean) => void;
  shouldValidatePassword?: boolean;
};

const uniqueId = "b7499b01-8082-4209-8667-c7d559a70cag";
export const DATA_TEST_ID = {
  TEXT_FIELD: `${uniqueId}-text-field`,
  TEXT_FIELD_INPUT: `${uniqueId}-custom-text-field-input`,
  ICON_BUTTON: `${uniqueId}-icon-button`,
  VISIBILITY_ON_ICON: `${uniqueId}-visibility-on-icon`,
  VISIBILITY_OFF_ICON: `${uniqueId}-visibility-off-icon`,
};

const PasswordInput: React.FC<Readonly<PasswordInputProps>> = ({
  showPassword: _showPassword,
  onValidityChange,
  onChange,
  shouldValidatePassword = true,
  value,
  ...props
}) => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(_showPassword);

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const type = useMemo(() => (showPassword ? "text" : "password"), [showPassword]);

  const passwordValidation = useMemo(() => {
    if (!shouldValidatePassword) return validatePassword("");
    if (typeof value !== "string") return validatePassword("");
    return validatePassword(value);
  }, [shouldValidatePassword, value]);

  const isPasswordValid = useMemo(
    () =>
      passwordValidation.isLongEnough &&
      passwordValidation.hasLowercase &&
      passwordValidation.hasUppercase &&
      passwordValidation.hasNumber &&
      passwordValidation.hasSpecialChar,
    [passwordValidation]
  );

  useEffect(() => {
    onValidityChange?.(isPasswordValid);
  }, [isPasswordValid, onValidityChange]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
  };

  const shouldShowHelperText = value !== "" && shouldValidatePassword && !isPasswordValid;

  return (
    <TextField
      {...props}
      type={type}
      onChange={handleChange}
      data-testid={DATA_TEST_ID.TEXT_FIELD}
      value={value}
      error={value !== "" && shouldValidatePassword && !isPasswordValid}
      helperText={shouldShowHelperText && <PasswordRequirements validationResults={passwordValidation} />}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label={t("theme.passwordInput.togglePasswordVisibility")}
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
