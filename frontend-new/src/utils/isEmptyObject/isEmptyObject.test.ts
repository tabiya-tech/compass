import isEmptyObject from "src/utils/isEmptyObject/isEmptyObject";

describe("isEmptyObject", () => {
  describe("when the object is empty", () => {
    test("should return true for an empty object", () => {
      // GIVEN an empty object
      const emptyObj = {};

      // WHEN isEmptyObject is called with the empty object
      const result = isEmptyObject(emptyObj);

      // THEN expect true to be returned
      expect(result).toBe(true);
    });

    test("should return true for an empty object created with Object.create(null)", () => {
      // GIVEN an empty object created with Object.create(null)
      const emptyObj = Object.create(null);

      // WHEN isEmptyObject is called with the empty object
      const result = isEmptyObject(emptyObj);

      // THEN expect true to be returned
      expect(result).toBe(true);
    });
  });

  describe("when the object is not empty", () => {
    test("should return false for an object with properties", () => {
      // GIVEN a non-empty object
      const nonEmptyObj = { key: "value" };

      // WHEN isEmptyObject is called with the non-empty object
      const result = isEmptyObject(nonEmptyObj);

      // THEN expect false to be returned
      expect(result).toBe(false);
    });

    test("should return false for an object with a single property", () => {
      // GIVEN a non-empty object with a single property
      const singlePropObj = { a: 1 };

      // WHEN isEmptyObject is called with the single property object
      const result = isEmptyObject(singlePropObj);

      // THEN expect false to be returned
      expect(result).toBe(false);
    });
  });
});
