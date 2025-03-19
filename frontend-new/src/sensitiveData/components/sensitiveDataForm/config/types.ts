// Field types
import { ConfigurationError } from "src/error/commonErrors";
import { isValidRegex } from "./utils";

export enum FieldType {
  String = 'STRING',
  Enum = 'ENUM',
  MultipleSelect = 'MULTIPLE_SELECT'
}

export class BaseFieldDefinition {
  name: string;
  dataKey: string;
  type: FieldType;
  required: boolean;
  label: string;
  questionText?: string; // Optional extended text displayed above the field
  constructor(attributes: any) {
    // name is required and must be a string
    if (!attributes.name || typeof attributes.name !== 'string') {
      throw new ConfigurationError("SensitiveData: Field 'name' is required and must be a string");
    }
    // dataKey is required and must be a string
    if (!attributes.dataKey || typeof attributes.dataKey !== 'string') {
      throw new ConfigurationError("SensitiveData: Field 'dataKey' is required and must be a string");
    }
    // type is required and must be a string
    if (!attributes.type || typeof attributes.type !== 'string') {
      throw new ConfigurationError("SensitiveData: Field 'type' is required and must be a string");
    }
    // If the type is not a valid FieldType, throw an error
    if (!Object.values(FieldType).includes(attributes.type)) {
      throw new ConfigurationError(`SensitiveData: Field 'type' value '${attributes.type}' is not valid`);
    }

    // required is required and must be a boolean
    if (attributes.required === undefined || typeof attributes.required !== 'boolean') {
      throw new ConfigurationError("SensitiveData: Field 'required' is required and must be a boolean");
    }
    // label is required and must be a string
    if (!attributes.label || typeof attributes.label !== 'string') {
      throw new ConfigurationError("SensitiveData: Field 'label' is required and must be a string");
    }
    // if questionText is provided, it must be a string
    if (attributes.questionText && typeof attributes.questionText !== 'string') {
      throw new ConfigurationError("SensitiveData: Field 'questionText' must be a string");
    }

    this.name = attributes.name;
    this.dataKey = attributes.dataKey;
    this.type = attributes.type;
    this.required = attributes.required;
    this.label = attributes.label;
    this.questionText = attributes.questionText;
  }
}

// Validation options for string fields
export interface StringValidation {
  pattern?: string; // Regex pattern for validation (can handle min/max length constraints)
  errorMessage?: string; // Custom error message to display
}

export class StringFieldDefinition  extends BaseFieldDefinition {
  type: FieldType.String;
  defaultValue?: string;
  validation?: StringValidation;

  constructor(attributes: any) {
    // Call the parent constructor for common field validation
    super(attributes);

    // type must exist and be "STRING"
    if (attributes.type !== FieldType.String) {
      throw new ConfigurationError('SensitiveData: Field type must be STRING');
    }
    // if defaultValue is provided, it must be a string
    if (attributes.defaultValue && typeof attributes.defaultValue !== 'string') {
      throw new ConfigurationError('SensitiveData: Field defaultValue must be a string');
    }

    if (attributes.validation) {
      // if validation is provided, it must be an object with pattern and errorMessage
      if(typeof attributes.validation !== 'object') {
        throw new ConfigurationError('SensitiveData: Field validation must be an object');
      }
      // if pattern is provided, it must be a string and a valid regex
      if (typeof attributes.validation.pattern !== 'string') {
        throw new ConfigurationError('SensitiveData: Field validation pattern must be a string');
      } else if (!isValidRegex(attributes.validation.pattern)) {
        throw new ConfigurationError('SensitiveData: Field validation pattern is not a valid regex');
      }
      // if errorMessage is provided, it must be a string
      if (typeof attributes.validation.errorMessage !== 'string') {
        throw new ConfigurationError('SensitiveData: Field validation errorMessage must be a string');
      }
    }
    this.defaultValue = attributes.defaultValue;
    this.validation = attributes.validation;
    this.type = FieldType.String;
  }
}

export class EnumFieldDefinition extends BaseFieldDefinition {
  type: FieldType.Enum;
  values: string[];
  defaultValue?: string;

  constructor(attributes: any) {
    // Call the parent constructor for common field validation
    super(attributes);

    // type must exist and be "ENUM"
    if (attributes.type !== FieldType.Enum) {
      throw new ConfigurationError('SensitiveData: Field type must be ENUM');
    }
    // values must be an array of strings
    if (!Array.isArray(attributes.values) || !attributes.values.every((value: any) => typeof value === 'string')) {
      throw new ConfigurationError('SensitiveData: Field values must be an array of strings');
    }
    // values must not be empty
    if (attributes.values.length === 0) {
      throw new ConfigurationError('SensitiveData: Field values must not be empty');
    }

    // if defaultValue is provided, it must be a string
    if (attributes.defaultValue && typeof attributes.defaultValue !== 'string') {
      throw new ConfigurationError('SensitiveData: Field defaultValue must be a string');
    }

    this.values = attributes.values;
    this.defaultValue = attributes.defaultValue;
    this.type = FieldType.Enum;
  }
}

export class MultipleSelectFieldDefinition extends BaseFieldDefinition {
  type: FieldType.MultipleSelect;
  values: string[];

  constructor(attributes: any) {
    // Call the parent constructor for common field validation
    super(attributes);

    // type must exist and be "MULTIPLE_SELECT"
    if (attributes.type !== FieldType.MultipleSelect) {
      throw new ConfigurationError('SensitiveData: Field type must be MULTIPLE_SELECT');
    }
    // values must be an array of strings
    if (!Array.isArray(attributes.values) || !attributes.values.every((value: any) => typeof value === 'string')) {
      throw new ConfigurationError('SensitiveData: Field values must be an array of strings');
    }
    // values must not be empty
    if (attributes.values.length === 0) {
      throw new ConfigurationError('SensitiveData: Field values must not be empty');
    }

    this.values = attributes.values;
    this.type = FieldType.MultipleSelect;
  }
}

// Union type for all field definitions
export type FieldDefinition = StringFieldDefinition | EnumFieldDefinition | MultipleSelectFieldDefinition;

// Debounce time for form input changes
export const DEBOUNCE_TIME = 250; // Helper function to create an empty SensitivePersonalData object with default values


