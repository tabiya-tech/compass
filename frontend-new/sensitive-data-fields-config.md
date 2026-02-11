# Sensitive Data Fields Configuration

This document describes the schema for configuring sensitive data fields collected from users in Compass.

## Overview

Sensitive data fields are configured via the `FRONTEND_SENSITIVE_DATA_FIELDS` environment variable in `env.js`. If not provided, a default configuration is used (defined in `src/sensitiveData/components/sensitiveDataForm/config/defaultFieldsConfig.ts`).

The configuration is a JSON object where keys are field names and values are field definitions.

## Field Types

### STRING

A text input field with optional regex validation.

```json
{
  "fieldName": {
    "dataKey": "field_name",
    "type": "STRING",
    "required": true,
    "label": { "en-US": "Field Label" },
    "questionText": { "en-US": "Optional question text displayed above the field" },
    "defaultValue": "optional default",
    "validation": {
      "pattern": "^[a-zA-Z]{2,50}$",
      "errorMessage": { "en-US": "Must be 2-50 letters" }
    }
  }
}
```

| Property                  | Type       | Required | Description                                               |
|---------------------------|------------|----------|-----------------------------------------------------------|
| `dataKey`                 | string     | Yes      | Unique key used for data storage (snake_case recommended) |
| `type`                    | `"STRING"` | Yes      | Field type identifier                                     |
| `required`                | boolean    | Yes      | Whether the field must be filled                          |
| `label`                   | LocaleMap  | Yes      | Display label for each locale                             |
| `questionText`            | LocaleMap  | No       | Extended question text displayed above the field          |
| `defaultValue`            | string     | No       | Default value for the field                               |
| `validation.pattern`      | string     | No*      | Regex pattern for validation                              |
| `validation.errorMessage` | LocaleMap  | No*      | Error message when validation fails                       |

*If `validation` is provided, both `pattern` and `errorMessage` are required.

### ENUM

A single-select dropdown field.

```json
{
  "fieldName": {
    "dataKey": "field_name",
    "type": "ENUM",
    "required": true,
    "label": { "en-US": "Field Label" },
    "questionText": { "en-US": "Optional question text" },
    "values": { "en-US": ["Option 1", "Option 2", "Option 3"] },
    "defaultValue": "Option 1"
  }
}
```

| Property       | Type                 | Required | Description                      |
|----------------|----------------------|----------|----------------------------------|
| `dataKey`      | string               | Yes      | Unique key used for data storage |
| `type`         | `"ENUM"`             | Yes      | Field type identifier            |
| `required`     | boolean              | Yes      | Whether the field must be filled |
| `label`        | LocaleMap            | Yes      | Display label for each locale    |
| `questionText` | LocaleMap            | No       | Extended question text           |
| `values`       | LocaleMap (string[]) | Yes      | Array of options for each locale |
| `defaultValue` | string               | No       | Default selected value           |

### MULTIPLE_SELECT

A multi-select field allowing multiple choices.

```json
{
  "fieldName": {
    "dataKey": "field_name",
    "type": "MULTIPLE_SELECT",
    "required": true,
    "label": { "en-US": "Field Label" },
    "values": { "en-US": ["Option A", "Option B", "Option C"] }
  }
}
```

| Property       | Type                 | Required | Description                                  |
|----------------|----------------------|----------|----------------------------------------------|
| `dataKey`      | string               | Yes      | Unique key used for data storage             |
| `type`         | `"MULTIPLE_SELECT"`  | Yes      | Field type identifier                        |
| `required`     | boolean              | Yes      | Whether at least one option must be selected |
| `label`        | LocaleMap            | Yes      | Display label for each locale                |
| `questionText` | LocaleMap            | No       | Extended question text                       |
| `values`       | LocaleMap (string[]) | Yes      | Array of options for each locale             |

## Localization Format (LocaleMap)

All user-facing text supports multiple locales using a locale map:

```json
{
  "en-US": "English (US) text",
  "en-GB": "English (UK) text",
  "es-ES": "Spanish (Spain) text",
  "es-AR": "Spanish (Argentina) text"
}
```

The system resolves values in this order:
1. Current user language (e.g., `es-ES`)
2. Default locale (e.g., `en-US`) as fallback

**Important:** At minimum, include the default locale (`en-US`) for all locale maps.

## Default Configuration

When `FRONTEND_SENSITIVE_DATA_FIELDS` is not set, these fields are used:

| Field             | DataKey            | Type   | Description                   |
|-------------------|--------------------|--------|-------------------------------|
| `name`            | `name`             | STRING | User's full name              |
| `contactEmail`    | `contact_email`    | STRING | Contact email address         |
| `gender`          | `gender`           | ENUM   | Gender (Male/Female)          |
| `age`             | `age`              | STRING | Age (16-120)                  |
| `educationStatus` | `education_status` | ENUM   | Highest education level       |
| `mainActivity`    | `main_activity`    | ENUM   | Main activity in last 30 days |

## Validation Rules

The system validates configurations at runtime:

- All fields must have unique `dataKey` values
- Required properties must be present
- `label` must include the current locale or default locale
- ENUM/MULTIPLE_SELECT must have non-empty `values` array
- STRING validation patterns must be valid regex

Validation errors are surfaced through the `useFieldsConfig` hook's `error` property.
