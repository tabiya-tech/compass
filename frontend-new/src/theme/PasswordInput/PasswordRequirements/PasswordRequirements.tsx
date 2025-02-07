import React from "react";
import { Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
const uniqueId = "480b210a-d548-4fc6-a2c0-35f46e98e537";

export const DATA_TEST_ID = {
  PASSWORD_REQUIREMENTS: `${uniqueId}-password-requirements`,
}

interface PasswordRequirementsProps {
  validationResults: {
    isLongEnough: boolean;
    hasLowercase: boolean;
    hasUppercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
}

const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ validationResults }) => {
  const theme = useTheme();

  const validationCriteria = [
    { label: "Password must be at least 8 characters long.", isValid: validationResults.isLongEnough },
    { label: "Password must include at least one lowercase letter.", isValid: validationResults.hasLowercase },
    { label: "Password must include at least one uppercase letter.", isValid: validationResults.hasUppercase },
    { label: "Password must include at least one number.", isValid: validationResults.hasNumber },
    {
      label: "Password must include at least one special character such as: !@#$%*& etc.",
      isValid: validationResults.hasSpecialChar,
    },
  ];

  return (
    // we have to use a component that can be a child of a <p>
    // since this is going to be used in the helperText field of an mui TextField component
    <p data-testid={DATA_TEST_ID.PASSWORD_REQUIREMENTS}>
      {validationCriteria.map((criteria, index) => (
        <>
          <Typography
            key={index}
            variant="caption"
            color={criteria.isValid ? theme.palette.success.dark : theme.palette.error.main}
          >
            * {criteria.label}
          </Typography>
          <br />
          {/* we need a <br /> to arrange the password requirements in a column */}
        </>
      ))}
    </p>
  );
};

export default PasswordRequirements;
