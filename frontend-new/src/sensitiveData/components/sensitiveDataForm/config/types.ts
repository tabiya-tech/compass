// Field types
export enum FieldType {
  String = 'STRING',
  Enum = 'ENUM',
  MultipleSelect = 'MULTIPLE_SELECT',
}

// Base field definition with common properties
export interface BaseFieldDefinition {
  name: string;
  dataKey: string;
  type: FieldType;
  required: boolean;
  label: string;
  questionText?: string; // Optional extended text displayed above the field
}

// Validation options for string fields
export interface StringValidation {
  pattern?: string; // Regex pattern for validation (can handle min/max length constraints)
  errorMessage?: string; // Custom error message to display
}

// String field definition
export interface StringFieldDefinition extends BaseFieldDefinition {
  type: FieldType.String;
  defaultValue?: string;
  validation?: StringValidation;
}

// Enum field definition
export interface EnumFieldDefinition extends BaseFieldDefinition {
  type: FieldType.Enum;
  values: string[];
  defaultValue?: string;
}

// Multiple field definition
export interface MultipleFieldDefinition extends BaseFieldDefinition {
  type: FieldType.MultipleSelect;
  values: string[];
}

// Union type for all field definitions
export type FieldDefinition = StringFieldDefinition | EnumFieldDefinition | MultipleFieldDefinition;

// Configuration structure from YAML
export type FieldsConfig = Record<string, FieldDefinition>;

// Debounce time for form input changes
export const DEBOUNCE_TIME = 250; // Helper function to create an empty SensitivePersonalData object with default values


