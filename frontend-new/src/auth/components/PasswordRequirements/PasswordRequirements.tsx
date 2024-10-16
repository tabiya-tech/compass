import React from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

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
    <Box display="flex" flexDirection="column">
      {validationCriteria.map((criteria, index) => (
        <Typography
          key={index}
          variant="caption"
          color={criteria.isValid ? theme.palette.success.dark : theme.palette.error.main}
        >
          * {criteria.label}
        </Typography>
      ))}
    </Box>
  );
};

export default PasswordRequirements;
