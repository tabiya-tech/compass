// src/utils/validation.ts
export const validatePassword = (password: string): string => {
  if (!/.{8,}/.test(password)) {
    return "Password must be at least 8 characters long.";
  }
  if (!/(?=.*[a-z])/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/(?=.*[A-Z])/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/(?=.*\d)/.test(password)) {
    return "Password must include at least one number.";
  }
  if (!/(?=.*[!-/:-@[-`{-~])/.test(password)) {
    return "Password must include at least one special character such as: !@#$%*& etc.";
  }
  return "";
};
