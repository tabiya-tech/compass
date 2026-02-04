import "src/_test_utilities/consoleMock";

import * as envService from "src/envService";
import { defaultSkillsReportOutputConfig } from "./default";
import { DownloadFormat } from "./types";
import { getSkillsReportOutputConfig } from "./getConfig";

jest.mock("src/envService", () => ({
  getSkillsReportOutputConfigEnvVar: jest.fn(),
}));

const defaultValue = defaultSkillsReportOutputConfig;

describe("getConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (console.warn as jest.Mock).mockClear();
  });

  describe("Default config", () => {
    test.each([undefined, null, [], {}, "", "[]", "{}", "undefined", "null", "invalid json format", defaultValue])(
      "should maintain return default value when env var is %s",
      (value) => {
        // GIVEN no env var is set (undefined)
        (envService.getSkillsReportOutputConfigEnvVar as jest.Mock).mockReturnValue(value);

        // WHEN getting the config
        const result = getSkillsReportOutputConfig();

        // THEN it should return the exact default config
        expect(result).toEqual(defaultValue);
      }
    );

    test("should maintain return the default when getEnv variable fails", () => {
      // GIVEN no env var is set (undefined)
      (envService.getSkillsReportOutputConfigEnvVar as jest.Mock).mockImplementation(() => {
        throw new Error("Failed to get env variable");
      });

      // WHEN getting the config
      const result = getSkillsReportOutputConfig();

      // THEN it should return the exact default config
      expect(result).toEqual(defaultValue);
    });
  });

  describe("downloadFormats", () => {
    test.each([
      [undefined, defaultValue.downloadFormats],
      [null, defaultValue.downloadFormats],
      [[], defaultValue.downloadFormats],
      [defaultValue.downloadFormats, defaultValue.downloadFormats],
      [[DownloadFormat.PDF], [DownloadFormat.PDF]],
      [[DownloadFormat.DOCX], [DownloadFormat.DOCX]],
      [
        [DownloadFormat.DOCX, DownloadFormat.PDF],
        [DownloadFormat.DOCX, DownloadFormat.PDF],
      ],
      [
        [DownloadFormat.DOCX, DownloadFormat.PDF, "additional-format"],
        [DownloadFormat.DOCX, DownloadFormat.PDF],
      ],
      [["invalid-format"], defaultValue.downloadFormats],
      ["invalid-string", defaultValue.downloadFormats],
    ])("should mark return the expected downloadFormats given the format: %s, expected: %s", (format, expected) => {
      // GIVEN the env var is set to the given format
      const customConfig = {
        downloadFormats: format,
      };
      (envService.getSkillsReportOutputConfigEnvVar as jest.Mock).mockReturnValue(JSON.stringify(customConfig));

      // WHEN getting the config
      const result = getSkillsReportOutputConfig();

      // THEN it should return the expected downloadFormats
      expect(result.downloadFormats).toEqual(expected);
    });
  });
});
