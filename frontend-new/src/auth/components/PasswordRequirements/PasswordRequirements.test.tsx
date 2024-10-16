import React from "react";
import { render, screen } from "@testing-library/react";
import PasswordRequirements from "src/auth/components/PasswordRequirements/PasswordRequirements";

describe("PasswordRequirements", () => {
  test("should render all password requirements", () => {
    // GIVEN validation results where all criteria are false
    const validationResults = {
      isLongEnough: false,
      hasLowercase: false,
      hasUppercase: false,
      hasNumber: false,
      hasSpecialChar: false,
    };

    // WHEN the component is rendered
    render(<PasswordRequirements validationResults={validationResults} />);

    // THEN expect to see all the criteria
    expect(screen.getByText(/Password must be at least 8 characters long/)).toBeInTheDocument();
    expect(screen.getByText(/Password must include at least one lowercase letter/)).toBeInTheDocument();
    expect(screen.getByText(/Password must include at least one uppercase letter/)).toBeInTheDocument();
    expect(screen.getByText(/Password must include at least one number/)).toBeInTheDocument();
    expect(screen.getByText(/Password must include at least one special character/)).toBeInTheDocument();
  });
});
