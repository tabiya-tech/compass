// src/utils/validation.test.ts
import { validatePassword } from "./validatePassword";

describe("validatePassword", () => {
  test("should return false for passwords less than 8 characters long", () => {
    // GIVEN a password less than 8 characters
    const password = "Ab1!";

    // WHEN validatePassword is called
    const result = validatePassword(password);

    // THEN expect the length validation to be false
    expect(result.isLongEnough).toBe(false);
  });

  test("should return false for passwords without a lowercase letter", () => {
    // GIVEN a password without a lowercase letter
    const password = "PASSWORD1!";

    // WHEN validatePassword is called
    const result = validatePassword(password);

    // THEN expect the lowercase validation to be false
    expect(result.hasLowercase).toBe(false);
  });

  test("should return false for passwords without an uppercase letter", () => {
    // GIVEN a password without an uppercase letter
    const password = "password1!";

    // WHEN validatePassword is called
    const result = validatePassword(password);

    // THEN expect the uppercase validation to be false
    expect(result.hasUppercase).toBe(false);
  });

  test("should return false for passwords without a number", () => {
    // GIVEN a password without a number
    const password = "Password!";

    // WHEN validatePassword is called
    const result = validatePassword(password);

    // THEN expect the number validation to be false
    expect(result.hasNumber).toBe(false);
  });

  test("should return false for passwords without a special character", () => {
    // GIVEN a password without a special character
    const password = "Password1";

    // WHEN validatePassword is called
    const result = validatePassword(password);

    // THEN expect the specialChar validation to be false
    expect(result.hasSpecialChar).toBe(false);
  });

  test("should return true for valid passwords", () => {
    // GIVEN a valid password
    const password = "Password1!";

    // WHEN validatePassword is called
    const result = validatePassword(password);

    // THEN expect all validation criteria to be true
    expect(result).toEqual({
      isLongEnough: true,
      hasLowercase: true,
      hasUppercase: true,
      hasNumber: true,
      hasSpecialChar: true,
    });
  });
});
