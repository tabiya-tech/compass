// src/utils/validation.ts
export const validatePassword = (password: string) => {
  return {
    isLongEnough: /.{8,}/.test(password),
    hasLowercase: /(?=.*[a-z])/.test(password),
    hasUppercase: /(?=.*[A-Z])/.test(password),
    hasNumber: /(?=.*\d)/.test(password),
    hasSpecialChar: /(?=.*[!-/:-@[-`{-~])/.test(password),
  };
};
