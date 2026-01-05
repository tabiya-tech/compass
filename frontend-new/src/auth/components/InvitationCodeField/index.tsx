import React, { useEffect, useRef } from "react";
import { TextField } from "@mui/material";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { REGISTRATION_CODE_FIELD_LABEL, REGISTRATION_CODE_TOAST_ID } from "src/config/registrationCode";

export type InvitationCodeFieldProps = {
  value: string;
  locked: boolean;
  label?: string;
  required?: boolean;
  dataTestId?: string;
  onChange: (value: string) => void;
};

const InvitationCodeField: React.FC<Readonly<InvitationCodeFieldProps>> = ({
  value,
  locked,
  label = REGISTRATION_CODE_FIELD_LABEL,
  required = true,
  dataTestId,
  onChange,
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const lastToastCode = useRef<string | null>(null);

  useEffect(() => {
    if (locked && value && lastToastCode.current !== value) {
      enqueueSnackbar(`${label}: ${value}`, {
        variant: "success",
        key: REGISTRATION_CODE_TOAST_ID,
      });
      lastToastCode.current = value;
    }
  }, [locked, value, enqueueSnackbar, label]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (locked) {
      return;
    }
    onChange(event.target.value);
  };

  return (
    <TextField
      fullWidth
      label={label}
      variant="outlined"
      required={required}
      value={value}
      onChange={handleChange}
      inputProps={dataTestId ? { "data-testid": dataTestId } : undefined}
      disabled={locked}
    />
  );
};

export default InvitationCodeField;
