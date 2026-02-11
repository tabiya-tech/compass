import "src/_test_utilities/consoleMock";
import { parseFieldsConfig, resolveLocale } from "./parseFieldsConfig";
import { FieldsConfig } from "./defaultFieldsConfig";
import { FieldType, StringFieldDefinition, EnumFieldDefinition, MultipleSelectFieldDefinition } from "./types";
import { ConfigurationError } from "src/error/commonErrors";

describe("test resolveLocale() function", () => {
  test("should return the value for the requested language when it exists", () => {
    // GIVEN a localized values object with multiple languages
    const givenValues = { "en-US": "Hello", "es-ES": "Hola" };
    // AND a requested language that exists in the values
    const givenLanguage = "en-US";
    // AND a default locale
    const givenDefaultLocale = "en-US";

    // WHEN resolveLocale is called
    const actualResult = resolveLocale(givenValues, givenLanguage, givenDefaultLocale);

    // THEN expect the value for the requested language to be returned
    expect(actualResult).toBe("Hello");
  });

  test("should return the value for a non-default language when requested", () => {
    // GIVEN a localized values object with multiple languages
    const givenValues = { "en-US": "Hello", "es-ES": "Hola" };
    // AND a requested language that exists in the values
    const givenLanguage = "es-ES";
    // AND a default locale
    const givenDefaultLocale = "en-US";

    // WHEN resolveLocale is called
    const actualResult = resolveLocale(givenValues, givenLanguage, givenDefaultLocale);

    // THEN expect the value for the requested language to be returned
    expect(actualResult).toBe("Hola");
  });

  test("should fall back to default locale when requested language is not available", () => {
    // GIVEN a localized values object with only English
    const givenValues = { "en-US": "Hello" };
    // AND a requested language that does not exist in the values
    const givenLanguage = "fr-FR";
    // AND a default locale that exists in the values
    const givenDefaultLocale = "en-US";

    // WHEN resolveLocale is called
    const actualResult = resolveLocale(givenValues, givenLanguage, givenDefaultLocale);

    // THEN expect the default locale value to be returned
    expect(actualResult).toBe("Hello");
  });

  test("should return undefined when value is undefined", () => {
    // GIVEN an undefined values object
    const givenValues = undefined;
    // AND a requested language
    const givenLanguage = "en-US";
    // AND a default locale
    const givenDefaultLocale = "en-US";

    // WHEN resolveLocale is called
    const actualResult = resolveLocale(givenValues, givenLanguage, givenDefaultLocale);

    // THEN expect undefined to be returned
    expect(actualResult).toBeUndefined();
  });

  test("should return undefined when neither requested language nor default locale is available", () => {
    // GIVEN a localized values object without the requested or default language
    const givenValues = { "de-DE": "Hallo" };
    // AND a requested language that does not exist
    const givenLanguage = "fr-FR";
    // AND a default locale that does not exist
    const givenDefaultLocale = "en-US";

    // WHEN resolveLocale is called
    const actualResult = resolveLocale(givenValues, givenLanguage, givenDefaultLocale);

    // THEN expect undefined to be returned
    expect(actualResult).toBeUndefined();
  });
});

describe("test parseFieldsConfig() function", () => {
  describe("successful parsing", () => {
    test("should parse a STRING field correctly", () => {
      // GIVEN a configuration with a STRING field
      const givenConfig: FieldsConfig = {
        testField: {
          dataKey: "test_field",
          type: FieldType.String,
          required: true,
          label: { "en-US": "Test Field" },
          validation: {
            pattern: "^[a-z]+$",
            errorMessage: { "en-US": "Must be lowercase letters" },
          },
        },
      };
      // AND a language
      const givenLanguage = "en-US";
      // AND a default locale
      const givenDefaultLocale = "en-US";

      // WHEN parseFieldsConfig is called
      const actualResult = parseFieldsConfig(givenConfig, givenLanguage, givenDefaultLocale);

      // THEN expect one field to be returned
      expect(actualResult).toHaveLength(1);
      // AND expect it to be a StringFieldDefinition instance
      expect(actualResult[0]).toBeInstanceOf(StringFieldDefinition);
      // AND expect the name to match the config key
      expect(actualResult[0].name).toBe("testField");
      // AND expect the dataKey to match
      expect(actualResult[0].dataKey).toBe("test_field");
      // AND expect the label to be resolved
      expect(actualResult[0].label).toBe("Test Field");
    });

    test("should parse an ENUM field correctly", () => {
      // GIVEN a configuration with an ENUM field
      const givenConfig: FieldsConfig = {
        genderField: {
          dataKey: "gender",
          type: FieldType.Enum,
          required: true,
          label: { "en-US": "Gender" },
          values: { "en-US": ["Male", "Female"] },
        },
      };
      // AND a language
      const givenLanguage = "en-US";
      // AND a default locale
      const givenDefaultLocale = "en-US";

      // WHEN parseFieldsConfig is called
      const actualResult = parseFieldsConfig(givenConfig, givenLanguage, givenDefaultLocale);

      // THEN expect one field to be returned
      expect(actualResult).toHaveLength(1);
      // AND expect it to be an EnumFieldDefinition instance
      expect(actualResult[0]).toBeInstanceOf(EnumFieldDefinition);
      // AND expect the values to match
      expect((actualResult[0] as EnumFieldDefinition).values).toEqual(["Male", "Female"]);
    });

    test("should parse a MULTIPLE_SELECT field correctly", () => {
      // GIVEN a configuration with a MULTIPLE_SELECT field
      const givenConfig: FieldsConfig = {
        interestsField: {
          dataKey: "interests",
          type: FieldType.MultipleSelect,
          required: false,
          label: { "en-US": "Interests" },
          values: { "en-US": ["Sports", "Music", "Art"] },
        },
      };
      // AND a language
      const givenLanguage = "en-US";
      // AND a default locale
      const givenDefaultLocale = "en-US";

      // WHEN parseFieldsConfig is called
      const actualResult = parseFieldsConfig(givenConfig, givenLanguage, givenDefaultLocale);

      // THEN expect one field to be returned
      expect(actualResult).toHaveLength(1);
      // AND expect it to be a MultipleSelectFieldDefinition instance
      expect(actualResult[0]).toBeInstanceOf(MultipleSelectFieldDefinition);
      // AND expect the values to match
      expect((actualResult[0] as MultipleSelectFieldDefinition).values).toEqual(["Sports", "Music", "Art"]);
    });

    test("should parse multiple fields correctly", () => {
      // GIVEN a configuration with multiple fields
      const givenConfig: FieldsConfig = {
        field1: {
          dataKey: "field_1",
          type: FieldType.String,
          required: true,
          label: { "en-US": "Field 1" },
        },
        field2: {
          dataKey: "field_2",
          type: FieldType.Enum,
          required: true,
          label: { "en-US": "Field 2" },
          values: { "en-US": ["A", "B"] },
        },
      };
      // AND a language
      const givenLanguage = "en-US";
      // AND a default locale
      const givenDefaultLocale = "en-US";

      // WHEN parseFieldsConfig is called
      const actualResult = parseFieldsConfig(givenConfig, givenLanguage, givenDefaultLocale);

      // THEN expect two fields to be returned
      expect(actualResult).toHaveLength(2);
    });

    test("should resolve localized values based on the requested language", () => {
      // GIVEN a configuration with multi-language labels
      const givenConfig: FieldsConfig = {
        nameField: {
          dataKey: "name",
          type: FieldType.String,
          required: true,
          label: { "en-US": "Name", "es-ES": "Nombre" },
        },
      };
      // AND a default locale
      const givenDefaultLocale = "en-US";

      // WHEN parseFieldsConfig is called with English
      const actualEnglishResult = parseFieldsConfig(givenConfig, "en-US", givenDefaultLocale);

      // THEN expect the English label to be returned
      expect(actualEnglishResult[0].label).toBe("Name");

      // AND WHEN parseFieldsConfig is called with Spanish
      const actualSpanishResult = parseFieldsConfig(givenConfig, "es-ES", givenDefaultLocale);

      // THEN expect the Spanish label to be returned
      expect(actualSpanishResult[0].label).toBe("Nombre");
    });

    test("should fall back to default locale when requested language is not available", () => {
      // GIVEN a configuration with only English labels
      const givenConfig: FieldsConfig = {
        nameField: {
          dataKey: "name",
          type: FieldType.String,
          required: true,
          label: { "en-US": "Name" },
        },
      };
      // AND a requested language that does not exist
      const givenLanguage = "fr-FR";
      // AND a default locale
      const givenDefaultLocale = "en-US";

      // WHEN parseFieldsConfig is called
      const actualResult = parseFieldsConfig(givenConfig, givenLanguage, givenDefaultLocale);

      // THEN expect the default locale label to be returned
      expect(actualResult[0].label).toBe("Name");
    });

    test("should parse optional questionText correctly", () => {
      // GIVEN a configuration with questionText
      const givenConfig: FieldsConfig = {
        educationField: {
          dataKey: "education",
          type: FieldType.Enum,
          required: true,
          label: { "en-US": "Education" },
          questionText: { "en-US": "What is your highest level of education?" },
          values: { "en-US": ["High School", "Bachelor's", "Master's"] },
        },
      };
      // AND a language
      const givenLanguage = "en-US";
      // AND a default locale
      const givenDefaultLocale = "en-US";

      // WHEN parseFieldsConfig is called
      const actualResult = parseFieldsConfig(givenConfig, givenLanguage, givenDefaultLocale);

      // THEN expect the questionText to be resolved
      expect(actualResult[0].questionText).toBe("What is your highest level of education?");
    });
  });

  describe("validation errors", () => {
    test("should throw ConfigurationError for invalid field definition", () => {
      // GIVEN a configuration with a null field definition
      const givenConfig = {
        invalidField: null as unknown as FieldsConfig["string"],
      };
      // AND a language
      const givenLanguage = "en-US";
      // AND a default locale
      const givenDefaultLocale = "en-US";

      // WHEN parseFieldsConfig is called
      const actualParseAction = () => parseFieldsConfig(givenConfig as FieldsConfig, givenLanguage, givenDefaultLocale);

      // THEN expect a ConfigurationError to be thrown
      expect(actualParseAction).toThrow(ConfigurationError);
      // AND expect the error message to indicate the invalid field
      expect(actualParseAction).toThrow("Invalid field definition for 'invalidField'");
    });

    test("should throw ConfigurationError when label is missing for the requested language", () => {
      // GIVEN a configuration with an empty label map
      const givenConfig: FieldsConfig = {
        fieldWithoutLabel: {
          dataKey: "field",
          type: FieldType.String,
          required: true,
          label: {},
        },
      };
      // AND a language
      const givenLanguage = "en-US";
      // AND a default locale
      const givenDefaultLocale = "en-US";

      // WHEN parseFieldsConfig is called
      const actualParseAction = () => parseFieldsConfig(givenConfig, givenLanguage, givenDefaultLocale);

      // THEN expect a ConfigurationError to be thrown
      expect(actualParseAction).toThrow(ConfigurationError);
      // AND expect the error message to indicate the missing label
      expect(actualParseAction).toThrow("Missing label for field 'fieldWithoutLabel' (lang=en-US)");
    });

    test("should throw ConfigurationError for invalid field type", () => {
      // GIVEN a configuration with an invalid field type
      const givenConfig = {
        invalidTypeField: {
          dataKey: "field",
          type: "UNKNOWN" as FieldType,
          required: true,
          label: { "en-US": "Field" },
        },
      };
      // AND a language
      const givenLanguage = "en-US";
      // AND a default locale
      const givenDefaultLocale = "en-US";

      // WHEN parseFieldsConfig is called
      const actualParseAction = () => parseFieldsConfig(givenConfig as FieldsConfig, givenLanguage, givenDefaultLocale);

      // THEN expect a ConfigurationError to be thrown
      expect(actualParseAction).toThrow(ConfigurationError);
      // AND expect the error message to indicate the invalid type
      expect(actualParseAction).toThrow("Invalid field type for 'invalidTypeField'");
    });

    test("should throw ConfigurationError for duplicate dataKey values", () => {
      // GIVEN a configuration with duplicate dataKey values
      const givenConfig: FieldsConfig = {
        field1: {
          dataKey: "duplicate_key",
          type: FieldType.String,
          required: true,
          label: { "en-US": "Field 1" },
        },
        field2: {
          dataKey: "duplicate_key",
          type: FieldType.String,
          required: true,
          label: { "en-US": "Field 2" },
        },
      };
      // AND a language
      const givenLanguage = "en-US";
      // AND a default locale
      const givenDefaultLocale = "en-US";

      // WHEN parseFieldsConfig is called
      const actualParseAction = () => parseFieldsConfig(givenConfig, givenLanguage, givenDefaultLocale);

      // THEN expect a ConfigurationError to be thrown
      expect(actualParseAction).toThrow(ConfigurationError);
      // AND expect the error message to indicate the duplicate dataKey
      expect(actualParseAction).toThrow("Duplicate dataKey 'duplicate_key'");
    });
  });

  describe("edge cases", () => {
    test("should return an empty array when config is empty", () => {
      // GIVEN an empty configuration
      const givenConfig: FieldsConfig = {};
      // AND a language
      const givenLanguage = "en-US";
      // AND a default locale
      const givenDefaultLocale = "en-US";

      // WHEN parseFieldsConfig is called
      const actualResult = parseFieldsConfig(givenConfig, givenLanguage, givenDefaultLocale);

      // THEN expect an empty array to be returned
      expect(actualResult).toEqual([]);
    });

    test("should handle fields without optional properties", () => {
      // GIVEN a configuration with only required properties
      const givenConfig: FieldsConfig = {
        minimalField: {
          dataKey: "minimal",
          type: FieldType.String,
          required: true,
          label: { "en-US": "Minimal Field" },
        },
      };
      // AND a language
      const givenLanguage = "en-US";
      // AND a default locale
      const givenDefaultLocale = "en-US";

      // WHEN parseFieldsConfig is called
      const actualResult = parseFieldsConfig(givenConfig, givenLanguage, givenDefaultLocale);

      // THEN expect one field to be returned
      expect(actualResult).toHaveLength(1);
      // AND expect optional properties to be undefined
      expect(actualResult[0].questionText).toBeUndefined();
    });
  });
});
