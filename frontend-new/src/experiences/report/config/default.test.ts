import { defaultSkillsReportOutputConfig } from "./default";

describe("Default Config", () => {
  test("should match snapshot", () => {
    // GIVEN the default configurations
    // THEN it should match the snapshot.
    expect(defaultSkillsReportOutputConfig).toMatchSnapshot();
  });
});
