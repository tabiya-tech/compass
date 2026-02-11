import "src/_test_utilities/consoleMock";

import { DEFAULT_FIELDS_CONFIG } from "./defaultFieldsConfig";
import { parseFieldsConfig } from "./parseFieldsConfig";
import { Locale } from "src/i18n/constants";

describe("DEFAULT_FIELDS_CONFIG", () => {
  beforeEach(() => {
    (console.warn as jest.Mock).mockClear();
    (console.error as jest.Mock).mockClear();
  });

  test.each(Object.values(Locale))("parseFieldsConfig should not throw given the locale is %s", (givenLocale) => {
    // WHEN parseFieldsConfig is called
    const fieldsDefinitions = parseFieldsConfig(DEFAULT_FIELDS_CONFIG, givenLocale, Locale.EN_US);

    // THEN the fields should match the snapshot
    expect(fieldsDefinitions).toMatchSnapshot();

    // AND the fields should have the same length
    expect(fieldsDefinitions.length).toBe(Object.keys(DEFAULT_FIELDS_CONFIG).length);

    // AND no errors should be logged
    expect(console.error).not.toHaveBeenCalled();

    // AND no warnings should be logged
    expect(console.warn).not.toHaveBeenCalled();
  });
});
