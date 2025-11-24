import { combineWords } from "./combineWords";

describe("combineWords", () => {
  test.each([
    [["a"], "a"], // One word
    [["a", "b"], "a and b"], // Two words
    [["a", "b", "c"], "a, b and c"], // Three words
    [["a", "b", "c", "d"], "a, b, c and d"], // Four words
  ])("should combine words: %p to return %p", (words, combination) => {
    // GIVEN a group of words
    // WHEN combineWords is called with the group of words
    const actual = combineWords(words);

    // THEN expect the combined words to be returned
    expect(actual).toBe(combination);
  });
});
