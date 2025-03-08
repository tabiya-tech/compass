import { useEffect, useState } from "react";
import { FieldDefinition, FieldsConfig } from "./types";
import { parseYamlConfig, getAllFields } from "./utils";
import Ajv from "ajv";
import { fieldsConfigSchema, validateUniqueDataKeys, validateFieldTypeRequirements } from "./schema";

const ajv = new Ajv();
const validate = ajv.compile(fieldsConfigSchema);

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
      const response = await fetch("/data/config/fields.yaml");
      if (!response.ok) {
        throw new Error(`Failed to load fields configuration: ${response.status} ${response.statusText}`);
      }

      const yamlText = await response.text();
      const loadedConfig: FieldsConfig = parseYamlConfig(yamlText);

      // Validate against JSON schema
      if (!validate(loadedConfig)) {
        throw new Error(`Invalid configuration: ${JSON.stringify(validate.errors)}`);
      }

      // Check for unique dataKeys
      const dataKeyErrors = validateUniqueDataKeys(loadedConfig);
      if (dataKeyErrors.length > 0) {
        throw new Error(`Configuration validation failed: ${dataKeyErrors.join(", ")}`);
      }

      // Check field type requirements
      const typeErrors = validateFieldTypeRequirements(loadedConfig);
      if (typeErrors.length > 0) {
        throw new Error(`Configuration validation failed: ${typeErrors.join(", ")}`);
      }

      setFields(getAllFields(loadedConfig));
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