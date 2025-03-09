import { useEffect, useState } from "react";
import {
  EnumFieldDefinition,
  FieldDefinition,
  FieldType,
  MultipleSelectFieldDefinition,
  StringFieldDefinition,
} from "./types";
import { parse } from "yaml";
import { ConfigurationError } from "src/error/commonErrors";

export const CONFIG_PATH = "/data/config/fields.yaml";

/**
 * React hook to load the fields configuration
 * @returns The loaded fields, loading state, and error state
 */
export const useFieldsConfig = () => {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      // Load from the public directory
      const response = await fetch(CONFIG_PATH);
      if (!response.ok) {
        throw new Error(`Failed to load fields configuration: ${response.status} ${response.statusText}`);
      }

      const yamlText = await response.text();
      const parsedDefinitions: FieldDefinition[] = parseYamlConfig(yamlText);

      setFields(parsedDefinitions);
      setLoading(false);
    };
    fetchConfig().catch(error => {
      console.error(error);
      setError(error instanceof Error ? error : new Error("Unknown error loading configuration"));
      setLoading(false);
    });
  }, []);

  return { fields, loading, error };
};

/**
 * Parses a YAML configuration string into a FieldsConfig object.
 *
 * @param yamlText - The YAML configuration string
 * @returns The parsed FieldsConfig object
 */

export const parseYamlConfig = (yamlText: string): FieldDefinition[] => {
  try {
    const dataKeys : string[] = [];
    const yamlJson = parse(yamlText) as Record<string, FieldDefinition>;

    // Convert the YAML object into an array of FieldDefinition objects
    // the yaml is setup in a way that the key is the name of the field
    // and the value is the rest of the field definition, so we need to
    // manually add the name to the field definition

    // The class constructors will validate the field definitions (types and required fields)
    const fieldDefinitions: FieldDefinition[] = Object.entries(yamlJson).map(([name, field]) => {
      dataKeys.push(field.dataKey);
      switch (field.type) {
        case FieldType.String:
          return new StringFieldDefinition({ ...field, name });
        case FieldType.Enum:
          return new EnumFieldDefinition({ ...field, name });
        case FieldType.MultipleSelect:
          return new MultipleSelectFieldDefinition({ ...field, name });
        default:
          throw new Error('Invalid field type');
      }
    });

    // Check for duplicate dataKeys
    const duplicateCount = dataKeys.length - new Set(dataKeys).size;
    if (duplicateCount > 0) {
      throw new ConfigurationError(`Sensitive Data: ${duplicateCount} duplicate dataKeys found in the configuration`);
    }

    return fieldDefinitions;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to parse fields configuration');
  }
};
