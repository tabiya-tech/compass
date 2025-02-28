import { useEffect, useState } from 'react';
import { FieldDefinition, FieldsConfig } from './types';
import { parseYamlConfig, getAllFields } from './utils';
import Ajv from 'ajv';
import { fieldsConfigSchema, validateUniqueDataKeys, validateFieldTypeRequirements } from './schema';

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
    let isMounted = true;

    const fetchConfig = async () => {
      try {
        // Load from the public directory
        const response = await fetch('/data/config/fields.yaml');
        if (!response.ok) {
          const err = new Error(`Failed to load fields configuration: ${response.status} ${response.statusText}`);
          console.error(err)
          throw err;
        }
        
        const yamlText = await response.text();
        const loadedConfig: FieldsConfig = parseYamlConfig(yamlText);
        
        // Validate against JSON schema
        if (!validate(loadedConfig)) {
          const err = new Error(`Invalid configuration: ${JSON.stringify(validate.errors)}`);
          console.error(err)
          throw err;
        }

        // Check for unique dataKeys
        const dataKeyErrors = validateUniqueDataKeys(loadedConfig);
        if (dataKeyErrors.length > 0) {
          const err = new Error(`Configuration validation failed: ${dataKeyErrors.join(', ')}`);
          console.error(err)
          throw err;
        }

        // Check field type requirements
        const typeErrors = validateFieldTypeRequirements(loadedConfig);
        if (typeErrors.length > 0) {
          const err = new Error(`Configuration validation failed: ${typeErrors.join(', ')}`);
          console.error(err)
          throw err;
        }
        
        if (isMounted) {
          setFields(getAllFields(loadedConfig));
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          setError(error instanceof Error ? error : new Error('Unknown error loading configuration'));
          setLoading(false);
        }
      }
    };

    fetchConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  return { fields, loading, error };
};