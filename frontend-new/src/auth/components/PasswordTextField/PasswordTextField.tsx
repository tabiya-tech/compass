import React from "react";
import { TextField, InputAdornment, useTheme } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import PrimaryIconButton from "src/theme/PrimaryIconButton/PrimaryIconButton";

interface PasswordTextFieldProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  error?: boolean;
  helperText?: string;
  disabled: boolean;
  inputProps?: object;
}

const PasswordTextField: React.FC<PasswordTextFieldProps> = ({
  value,
  onChange,
  error,
  helperText,
  disabled,
  inputProps,
}) => {
  const theme = useTheme();
  const [showPassword, setShowPassword] = React.useState(false);

  const handlePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <TextField
      fullWidth
      label="Password"
      type={showPassword ? "text" : "password"}
      variant="outlined"
      disabled={disabled}
      value={value}
      required
      onChange={onChange}
      error={error}
      helperText={helperText}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <PrimaryIconButton
              title="password visibility"
              sx={{
                color: theme.palette.text.secondary,
              }}
              onClick={handlePasswordVisibility}
            >
              {showPassword ? <VisibilityOff /> : <Visibility />}
            </PrimaryIconButton>
          </InputAdornment>
        ),
        inputProps: inputProps,
      }}
    />
  );
};

export default PasswordTextField;
