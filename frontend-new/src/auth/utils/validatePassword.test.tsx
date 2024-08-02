// src/utils/validation.test.ts
import { validatePassword } from "./validatePassword";

describe("validatePassword", () => {
  test("should return error for passwords less than 8 characters long", () => {
    // GIVEN a password less than 8 characters
    const password = "Ab1!";

    // WHEN validatePassword is called
    const result = validatePassword(password);

    // THEN expect the correct error message
    expect(result).toBe("Password must be at least 8 characters long.");
  });

  test("should return error for passwords without a lowercase letter", () => {
    // GIVEN a password without a lowercase letter
    const password = "PASSWORD1!";

    // WHEN validatePassword is called
    const result = validatePassword(password);

    // THEN expect the correct error message
    expect(result).toBe("Password must include at least one lowercase letter.");
  });

  test("should return error for passwords without an uppercase letter", () => {
    // GIVEN a password without an uppercase letter
    const password = "password1!";

    // WHEN validatePassword is called
    const result = validatePassword(password);

    // THEN expect the correct error message
    expect(result).toBe("Password must include at least one uppercase letter.");
  });

  test("should return error for passwords without a number", () => {
    // GIVEN a password without a number
    const password = "Password!";

    // WHEN validatePassword is called
    const result = validatePassword(password);

    // THEN expect the correct error message
    expect(result).toBe("Password must include at least one number.");
  });

  test("should return error for passwords without a special character", () => {
    // GIVEN a password without a special character
    const password = "Password1";

    // WHEN validatePassword is called
    const result = validatePassword(password);

    // THEN expect the correct error message
    expect(result).toBe("Password must include at least one special character.");
  });

  test("should return empty string for valid passwords", () => {
    // GIVEN a valid password
    const password = "Password1!";

    // WHEN validatePassword is called
    const result = validatePassword(password);

    // THEN expect no error message
    expect(result).toBe("");
  });
});
