/**
 * Combines an array of statements into a single string with proper punctuation.
 * e.g.: ["Skill A", "Skill B", "Skill C"] -> Skill A, SKill B and Skill C
 * @param statements
 */
export const combineWords = (statements: string[]): string => {
  if (statements.length === 0) return "";

  if (statements.length === 1) return statements[0];

  return statements.slice(0, -1).join(", ") + " and " + statements.slice(-1);
};
