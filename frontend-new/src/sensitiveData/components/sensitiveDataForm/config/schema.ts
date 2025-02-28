import { FieldsConfig } from './types';

const stringFieldValidationSchema = {
  type: 'object',
  properties: {
    pattern: { type: 'string' },
    errorMessage: { type: 'string' }
  },
  required: ['pattern', 'errorMessage'],
  additionalProperties: false
} as const;

export const fieldsConfigSchema = {
  type: 'object',
  patternProperties: {
    ".*": {
      type: 'object',
      properties: {
        dataKey: { type: 'string' },
        type: { type: 'string', enum: ['STRING', 'ENUM', 'MULTIPLE_SELECT'] },
        required: { type: 'boolean' },
        label: { type: 'string' },
        validation: {
          ...stringFieldValidationSchema,
          nullable: true
        },
        defaultValue: {
          oneOf: [
            { type: 'string', nullable: true },
            { type: 'array', items: { type: 'string' }, nullable: true }
          ]
        },
        questionText: { type: 'string', nullable: true },
        values: {
          type: 'array',
          items: { type: 'string' },
          nullable: true
        }
      },
      required: ['dataKey', 'type', 'required', 'label'],
      additionalProperties: false
    }
  },
  additionalProperties: false
} as const;

// Custom validation function to check for unique dataKeys
export const validateUniqueDataKeys = (config: FieldsConfig): string[] => {
  const dataKeys = new Set<string>();
  const errors: string[] = [];

  Object.entries(config).forEach(([fieldName, field]) => {
    if (dataKeys.has(field.dataKey)) {
      errors.push(`Duplicate dataKey "${field.dataKey}" found in field "${fieldName}"`);
    }
    dataKeys.add(field.dataKey);
  });

  return errors;
};

// Custom validation function to check field type-specific requirements
export const validateFieldTypeRequirements = (config: FieldsConfig): string[] => {
  const errors: string[] = [];

  Object.entries(config).forEach(([fieldName, field]) => {
    switch (field.type) {
      case 'STRING':
        if ('values' in field) {
          errors.push(`Field "${fieldName}" of type STRING should not have values property`);
        }
        break;
      case 'ENUM':
      case 'MULTIPLE_SELECT':
        if (!field.values || field.values.length === 0) {
          errors.push(`Field "${fieldName}" of type ${field.type} must have non-empty values array`);
        }
        if ('validation' in field) {
          errors.push(`Field "${fieldName}" of type ${field.type} should not have validation property`);
        }
        break;
    }
  });

  return errors;
}; 