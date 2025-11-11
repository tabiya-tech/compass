import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  const validationCriteria = useMemo(() => [
    { label: t("common.validation.passwordMinLength"), isValid: validationResults.isLongEnough },
    { label: t("common.validation.passwordNeedLowercase"), isValid: validationResults.hasLowercase },
    { label: t("common.validation.passwordNeedUppercase"), isValid: validationResults.hasUppercase },
    { label: t("common.validation.passwordNeedNumber"), isValid: validationResults.hasNumber },
    {
      label: t("common.validation.passwordNeedSpecialChar"),
      isValid: validationResults.hasSpecialChar,
    },
  ], [validationResults, t]);

  return (
    // we have to use a component that can be a child of a <p>
    // since this is going to be used in the helperText field of an mui TextField component
    <span data-testid={DATA_TEST_ID.PASSWORD_REQUIREMENTS}>
      {validationCriteria.map((criteria, index) => (
        <span key={index}>
          <Typography
            variant="caption"
            color={criteria.isValid ? theme.palette.success.dark : theme.palette.error.main}
          >
            * {criteria.label}
          </Typography>
          <br />
          {/* we need a <br /> to arrange the password requirements in a column */}
        </span>
      ))}
    </span>
  );
};

export default PasswordRequirements;
