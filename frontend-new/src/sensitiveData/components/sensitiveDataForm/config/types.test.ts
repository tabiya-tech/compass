import {
  BaseFieldDefinition,
  StringFieldDefinition,
  EnumFieldDefinition,
  MultipleSelectFieldDefinition,
  FieldType,
} from "./types";
import { ConfigurationError } from "src/error/commonErrors";

describe("BaseFieldDefinition", () => {
  // GIVEN valid parameters for base field creation
  const validBaseParams = {
    name: "testField",
    dataKey: "testKey",
    type: FieldType.String,
    required: true,
    label: "Test Label",
  };

  test("should create instance when given all required parameters", () => {
    // WHEN creating a base field with valid required params
    const field = new BaseFieldDefinition(validBaseParams);

    // THEN expect all properties to be set correctly
    expect(field.name).toBe(validBaseParams.name);
    expect(field.dataKey).toBe(validBaseParams.dataKey);
    expect(field.type).toBe(validBaseParams.type);
    expect(field.required).toBe(validBaseParams.required);
    expect(field.label).toBe(validBaseParams.label);
  });

  test("should create instance with optional questionText", () => {
    // GIVEN base params with optional questionText
    const paramsWithQuestionText = {
      ...validBaseParams,
      questionText: "Test Question?",
    };

    // WHEN creating a base field with optional param
    const field = new BaseFieldDefinition(paramsWithQuestionText);

    // THEN expect questionText to be set
    expect(field.questionText).toBe(paramsWithQuestionText.questionText);
  });

  // Test each required parameter missing or invalid
  test.each([
    ["name", { ...validBaseParams, name: undefined }],
    ["dataKey", { ...validBaseParams, dataKey: undefined }],
    ["type", { ...validBaseParams, type: undefined }],
    ["required", { ...validBaseParams, required: undefined }],
    ["label", { ...validBaseParams, label: undefined }],
  ])("should throw error when %s is missing", (param, invalidParams) => {
    // WHEN creating a base field with missing required param
    // THEN expect error to be thrown
    expect(() => new BaseFieldDefinition(invalidParams)).toThrow(ConfigurationError);
  });

  describe("invalid field types", () => {
    // GIVEN valid base parameters
    const validBaseParams = {
      name: "testField",
      dataKey: "testKey",
      type: FieldType.String,
      required: true,
      label: "Test Label",
    };

    describe("name field validation", () => {
      test.each([
        ["number", { ...validBaseParams, name: 123 }],
        ["boolean", { ...validBaseParams, name: true }],
        ["null", { ...validBaseParams, name: null }],
        ["object", { ...validBaseParams, name: {} }],
        ["array", { ...validBaseParams, name: [] }],
        ["undefined", { ...validBaseParams, name: undefined }],
      ])("should throw error when name is a %s", (type, invalidParams) => {
        // WHEN creating a base field with invalid name type
        // THEN expect error to be thrown
        expect(() => new BaseFieldDefinition(invalidParams)).toThrow(
          new ConfigurationError("SensitiveData: Field 'name' is required and must be a string")
        );
      });
    });

    describe("dataKey field validation", () => {
      test.each([
        ["number", { ...validBaseParams, dataKey: 123 }],
        ["boolean", { ...validBaseParams, dataKey: true }],
        ["null", { ...validBaseParams, dataKey: null }],
        ["object", { ...validBaseParams, dataKey: {} }],
        ["array", { ...validBaseParams, dataKey: [] }],
        ["undefined", { ...validBaseParams, dataKey: undefined }],
      ])("should throw error when dataKey is a %s", (type, invalidParams) => {
        // WHEN creating a base field with invalid dataKey type
        // THEN expect error to be thrown
        expect(() => new BaseFieldDefinition(invalidParams)).toThrow(
          new ConfigurationError("SensitiveData: Field 'dataKey' is required and must be a string")
        );
      });
    });

    describe("type field validation", () => {
      test.each([
        ["number", { ...validBaseParams, type: 123 }],
        ["boolean", { ...validBaseParams, type: true }],
        ["null", { ...validBaseParams, type: null }],
        ["object", { ...validBaseParams, type: {} }],
        ["array", { ...validBaseParams, type: [] }],
        ["undefined", { ...validBaseParams, type: undefined }],
      ])("should throw error when type is a %s", (type, invalidParams) => {
        // WHEN creating a base field with invalid type
        // THEN expect error to be thrown
        expect(() => new BaseFieldDefinition(invalidParams)).toThrow(
          new ConfigurationError("SensitiveData: Field 'type' is required and must be a string")
        );
      });

      // Note: Base class only validates that type is a string, not that it's a valid FieldType
      test("should not allow any value that is not in the FieldsType", () => {
        // GIVEN params with string type that's not in FieldType enum
        const params = { ...validBaseParams, type: "FOO_INVALID_TYPE" };

        // WHEN creating a base field
        // THEN expect error to be thrown
        expect(() => new BaseFieldDefinition(params)).toThrow(
          new ConfigurationError("SensitiveData: Field 'type' value 'FOO_INVALID_TYPE' is not valid")
        );
      });
    });

    describe("required field validation", () => {
      test.each([
        ["number", { ...validBaseParams, required: 123 }],
        ["string", { ...validBaseParams, required: "true" }],
        ["null", { ...validBaseParams, required: null }],
        ["object", { ...validBaseParams, required: {} }],
        ["array", { ...validBaseParams, required: [] }],
        ["undefined", { ...validBaseParams, required: undefined }],
      ])("should throw error when required is a %s", (type, invalidParams) => {
        // WHEN creating a base field with invalid required type
        // THEN expect error to be thrown
        expect(() => new BaseFieldDefinition(invalidParams)).toThrow(
          new ConfigurationError("SensitiveData: Field 'required' is required and must be a boolean")
        );
      });
    });

    describe("label field validation", () => {
      test.each([
        ["number", { ...validBaseParams, label: 123 }],
        ["boolean", { ...validBaseParams, label: true }],
        ["null", { ...validBaseParams, label: null }],
        ["object", { ...validBaseParams, label: {} }],
        ["array", { ...validBaseParams, label: [] }],
        ["undefined", { ...validBaseParams, label: undefined }],
      ])("should throw error when label is a %s", (type, invalidParams) => {
        // WHEN creating a base field with invalid label type
        // THEN expect error to be thrown
        expect(() => new BaseFieldDefinition(invalidParams)).toThrow(
          new ConfigurationError("SensitiveData: Field 'label' is required and must be a string")
        );
      });
    });

    describe("questionText field validation", () => {
      test.each([
        ["number", { ...validBaseParams, questionText: 123 }],
        ["boolean", { ...validBaseParams, questionText: true }],
        ["object", { ...validBaseParams, questionText: {} }],
        ["array", { ...validBaseParams, questionText: [] }],
      ])("should throw error when questionText is a %s", (type, invalidParams) => {
        // WHEN creating a base field with invalid questionText type
        // THEN expect error to be thrown
        expect(() => new BaseFieldDefinition(invalidParams)).toThrow(
          new ConfigurationError("SensitiveData: Field 'questionText' must be a string")
        );
      });

      test.each([
        ["null", { ...validBaseParams, questionText: null }],
        ["undefined", { ...validBaseParams, questionText: undefined }],
      ])("should allow %s questionText", (type, params) => {
        // WHEN creating a base field with null/undefined questionText
        const field = new BaseFieldDefinition(params);

        // THEN expect it to be created successfully
        expect(field.questionText).toBe(params.questionText);
      });
    });
  });
});

describe("StringFieldDefinition", () => {
  // GIVEN valid parameters for string field creation
  const validStringParams = {
    name: "testField",
    dataKey: "testKey",
    type: FieldType.String,
    required: true,
    label: "Test Label",
  };

  test("should create instance when given all required parameters", () => {
    // WHEN creating a string field with valid required params
    const field = new StringFieldDefinition(validStringParams);

    // THEN expect all properties to be set correctly
    expect(field.type).toBe(FieldType.String);
    expect(field.name).toBe(validStringParams.name);
  });

  test("should create instance with optional parameters", () => {
    // GIVEN string params with optional fields
    const paramsWithOptional = {
      ...validStringParams,
      defaultValue: "default",
      validation: {
        pattern: "^[a-z]+$",
        errorMessage: "Only lowercase letters allowed",
      },
    };

    // WHEN creating a string field with optional params
    const field = new StringFieldDefinition(paramsWithOptional);

    // THEN expect optional fields to be set
    expect(field.defaultValue).toBe(paramsWithOptional.defaultValue);
    expect(field.validation).toEqual(paramsWithOptional.validation);
  });

  test("should throw error when type is not STRING", () => {
    // GIVEN params with wrong type
    const invalidParams = { ...validStringParams, type: FieldType.Enum };

    // WHEN creating a string field with wrong type
    // THEN expect error to be thrown
    expect(() => new StringFieldDefinition(invalidParams)).toThrow(ConfigurationError);
  });

  test("should throw error when defaultValue is invalid type", () => {
    // GIVEN params with invalid defaultValue
    const invalidParams = { ...validStringParams, defaultValue: 123 };

    // WHEN creating a string field with invalid defaultValue
    // THEN expect error to be thrown
    expect(() => new StringFieldDefinition(invalidParams)).toThrow(ConfigurationError);
  });

  test("should throw error when validation pattern is invalid regex", () => {
    // GIVEN params with invalid regex pattern
    const invalidParams = {
      ...validStringParams,
      validation: {
        pattern: "[", // Invalid regex
        errorMessage: "Error",
      },
    };

    // WHEN creating a string field with invalid regex
    // THEN expect error to be thrown
    expect(() => new StringFieldDefinition(invalidParams)).toThrow(ConfigurationError);
  });

  describe("invalid field types", () => {
    describe("defaultValue field validation", () => {
      test.each([
        ["number", { ...validStringParams, defaultValue: 123 }],
        ["boolean", { ...validStringParams, defaultValue: true }],
        ["object", { ...validStringParams, defaultValue: {} }],
        ["array", { ...validStringParams, defaultValue: [] }],
      ])("should throw error when defaultValue is a %s", (type, invalidParams) => {
        // WHEN creating a string field with invalid defaultValue type
        // THEN expect error to be thrown
        expect(() => new StringFieldDefinition(invalidParams)).toThrow(ConfigurationError);
      });

      test.each([
        ["null", { ...validStringParams, defaultValue: null }],
        ["undefined", { ...validStringParams, defaultValue: undefined }],
      ])("should allow %s defaultValue", (type, params) => {
        // WHEN creating a string field with null/undefined defaultValue
        const field = new StringFieldDefinition(params);

        // THEN expect it to be created successfully
        expect(field.defaultValue).toBe(params.defaultValue);
      });
    });

    describe("validation field validation", () => {
      test.each([
        ["number", { ...validStringParams, validation: 123 }],
        ["string", { ...validStringParams, validation: "invalid" }],
        ["boolean", { ...validStringParams, validation: true }],
        ["array", { ...validStringParams, validation: [] }],
        ["invalid pattern type", { ...validStringParams, validation: { pattern: 123, errorMessage: "error" } }],
        ["invalid errorMessage type", { ...validStringParams, validation: { pattern: "^[a-z]+$", errorMessage: 123 } }],
        ["missing errorMessage", { ...validStringParams, validation: { pattern: "^[a-z]+$" } }],
        ["missing pattern", { ...validStringParams, validation: { errorMessage: "error" } }],
      ])("should throw error when validation is a %s", (type, invalidParams) => {
        // WHEN creating a string field with invalid validation
        // THEN expect error to be thrown
        expect(() => new StringFieldDefinition(invalidParams)).toThrow(ConfigurationError);
      });

      test.each([
        ["null", { ...validStringParams, validation: null }],
        ["undefined", { ...validStringParams, validation: undefined }],
      ])("should allow %s validation", (type, params) => {
        // WHEN creating a string field with null/undefined validation
        const field = new StringFieldDefinition(params);

        // THEN expect it to be created successfully
        expect(field.validation).toBe(params.validation);
      });
    });
  });
});

describe("EnumFieldDefinition", () => {
  // GIVEN valid parameters for enum field creation
  const validEnumParams = {
    name: "testField",
    dataKey: "testKey",
    type: FieldType.Enum,
    required: true,
    label: "Test Label",
    values: ["option1", "option2"],
  };

  test("should create instance when given all required parameters", () => {
    // WHEN creating an enum field with valid required params
    const field = new EnumFieldDefinition(validEnumParams);

    // THEN expect all properties to be set correctly
    expect(field.type).toBe(FieldType.Enum);
    expect(field.values).toEqual(validEnumParams.values);
  });

  test("should create instance with optional defaultValue", () => {
    // GIVEN enum params with defaultValue
    const paramsWithDefault = {
      ...validEnumParams,
      defaultValue: "option1",
    };

    // WHEN creating an enum field with defaultValue
    const field = new EnumFieldDefinition(paramsWithDefault);

    // THEN expect defaultValue to be set
    expect(field.defaultValue).toBe(paramsWithDefault.defaultValue);
  });

  test("should throw error when type is not ENUM", () => {
    // GIVEN params with wrong type
    const invalidParams = { ...validEnumParams, type: FieldType.String };

    // WHEN creating an enum field with wrong type
    // THEN expect error to be thrown
    expect(() => new EnumFieldDefinition(invalidParams)).toThrow(ConfigurationError);
  });

  test("should throw error when values is empty array", () => {
    // GIVEN params with empty values array
    const invalidParams = { ...validEnumParams, values: [] };

    // WHEN creating an enum field with empty values
    // THEN expect error to be thrown
    expect(() => new EnumFieldDefinition(invalidParams)).toThrow(ConfigurationError);
  });

  test("should throw error when values contains non-strings", () => {
    // GIVEN params with invalid values
    const invalidParams = { ...validEnumParams, values: ["option1", 123] };

    // WHEN creating an enum field with invalid values
    // THEN expect error to be thrown
    expect(() => new EnumFieldDefinition(invalidParams)).toThrow(ConfigurationError);
  });

  describe("invalid field types", () => {
    describe("values field validation", () => {
      test.each([
        ["number", { ...validEnumParams, values: 123 }],
        ["string", { ...validEnumParams, values: "invalid" }],
        ["boolean", { ...validEnumParams, values: true }],
        ["null", { ...validEnumParams, values: null }],
        ["object", { ...validEnumParams, values: {} }],
        ["array with numbers", { ...validEnumParams, values: ["option1", 123] }],
        ["array with booleans", { ...validEnumParams, values: ["option1", true] }],
        ["array with objects", { ...validEnumParams, values: ["option1", {}] }],
        ["array with null", { ...validEnumParams, values: ["option1", null] }],
        ["empty array", { ...validEnumParams, values: [] }],
      ])("should throw error when values is a %s", (type, invalidParams) => {
        // WHEN creating an enum field with invalid values
        // THEN expect error to be thrown
        expect(() => new EnumFieldDefinition(invalidParams)).toThrow(ConfigurationError);
      });
    });

    describe("defaultValue field validation", () => {
      test.each([
        ["number", { ...validEnumParams, defaultValue: 123 }],
        ["boolean", { ...validEnumParams, defaultValue: true }],
        ["object", { ...validEnumParams, defaultValue: {} }],
        ["array", { ...validEnumParams, defaultValue: [] }],
      ])("should throw error when defaultValue is a %s", (type, invalidParams) => {
        // WHEN creating an enum field with invalid defaultValue type
        // THEN expect error to be thrown
        expect(() => new EnumFieldDefinition(invalidParams)).toThrow(ConfigurationError);
      });

      test.each([
        ["null", { ...validEnumParams, defaultValue: null }],
        ["undefined", { ...validEnumParams, defaultValue: undefined }],
        ["invalid option", { ...validEnumParams, defaultValue: "invalidOption" }],
      ])("should allow %s defaultValue", (type, params) => {
        // WHEN creating an enum field with null/undefined/invalid defaultValue
        const field = new EnumFieldDefinition(params);

        // THEN expect it to be created successfully
        expect(field.defaultValue).toBe(params.defaultValue);
      });
    });
  });
});

describe("MultipleSelectFieldDefinition", () => {
  // GIVEN valid parameters for multiple select field creation
  const validMultipleParams = {
    name: "testField",
    dataKey: "testKey",
    type: FieldType.MultipleSelect,
    required: true,
    label: "Test Label",
    values: ["option1", "option2"],
  };

  test("should create instance when given all required parameters", () => {
    // WHEN creating a multiple select field with valid required params
    const field = new MultipleSelectFieldDefinition(validMultipleParams);

    // THEN expect all properties to be set correctly
    expect(field.type).toBe(FieldType.MultipleSelect);
    expect(field.values).toEqual(validMultipleParams.values);
  });

  test("should throw error when type is not MULTIPLE_SELECT", () => {
    // GIVEN params with wrong type
    const invalidParams = { ...validMultipleParams, type: FieldType.String };

    // WHEN creating a multiple select field with wrong type
    // THEN expect error to be thrown
    expect(() => new MultipleSelectFieldDefinition(invalidParams)).toThrow(ConfigurationError);
  });

  test("should throw error when values is empty array", () => {
    // GIVEN params with empty values array
    const invalidParams = { ...validMultipleParams, values: [] };

    // WHEN creating a multiple select field with empty values
    // THEN expect error to be thrown
    expect(() => new MultipleSelectFieldDefinition(invalidParams)).toThrow(ConfigurationError);
  });

  test("should throw error when values contains non-strings", () => {
    // GIVEN params with invalid values
    const invalidParams = { ...validMultipleParams, values: ["option1", 123] };

    // WHEN creating a multiple select field with invalid values
    // THEN expect error to be thrown
    expect(() => new MultipleSelectFieldDefinition(invalidParams)).toThrow(ConfigurationError);
  });

  describe("invalid field types", () => {
    describe("values field validation", () => {
      test.each([
        ["number", { ...validMultipleParams, values: 123 }],
        ["string", { ...validMultipleParams, values: "invalid" }],
        ["boolean", { ...validMultipleParams, values: true }],
        ["null", { ...validMultipleParams, values: null }],
        ["object", { ...validMultipleParams, values: {} }],
        ["array with numbers", { ...validMultipleParams, values: ["option1", 123] }],
        ["array with booleans", { ...validMultipleParams, values: ["option1", true] }],
        ["array with objects", { ...validMultipleParams, values: ["option1", {}] }],
        ["array with null", { ...validMultipleParams, values: ["option1", null] }],
        ["empty array", { ...validMultipleParams, values: [] }],
      ])("should throw error when values is a %s", (type, invalidParams) => {
        // WHEN creating a multiple select field with invalid values
        // THEN expect error to be thrown
        expect(() => new MultipleSelectFieldDefinition(invalidParams)).toThrow(ConfigurationError);
      });
    });
  });
});
