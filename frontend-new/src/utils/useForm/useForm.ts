import React, { useState, useMemo, useCallback } from "react";

/**
 * Represents a field with specific validation and default value constraints.
 */
type Field<ValueType> = {
  required: boolean;
  defaultValue: ValueType;
};

export type UseFormHookParams<DataType> = {
  fields: {
    [Key in keyof DataType]: Field<DataType[Key]>;
  };
};

type FieldFormProps<DataType> = {
  [Key in keyof DataType]: {
    required: boolean;
    value: DataType[Key];
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
};

type UseFormHookReturn<DataType> = {
  errors: Record<keyof DataType, string | null>;
  values: DataType;
  setValue: <Key extends keyof DataType>(key: Key, value: DataType[Key]) => void;
  fieldFormProps: FieldFormProps<DataType>;
  isFormValid: boolean;
};

/**
 * Custom hook to manage form state, including values and validation errors.
 * Allows updating fields and validating each field upon update.
 *
 * @template DataType - A generic type representing the shape of form data.
 *
 * @param {Object} params - Object containing the parameters for the useForm hook.
 * @param {Record<string, { defaultValue: DataType[keyof DataType], required?: boolean }>} params.fields - Defines the fields in the form along with their default values and validation requirements.
 *
 * @return {Object} Returns an object with the following properties and functions:
 * - values: The current values of all fields in the form.
 * - errors: An object representing validation errors for each field, where null indicates no error.
 * - setValue: A function to update the value of a specific form field.
 * - fieldFormProps: An object mapping each field key to form input properties, including current value and change handler.
 * - isFormValid: A boolean indicating the overall validity of the form based on validation conditions.
 */
export function useForm<DataType>({ fields }: UseFormHookParams<DataType>): UseFormHookReturn<DataType> {
  // create initial values object
  let initialValues = Object.keys(fields).reduce((acc, key) => {
    acc[key as keyof DataType] = fields[key as keyof DataType].defaultValue;
    return acc;
  }, {} as DataType);

  // create initial errors object
  const initialErrors = Object.keys(fields).reduce(
    (acc, key) => {
      // by default all fields are valid, have no errors
      acc[key as keyof DataType] = null;
      return acc;
    },
    {} as Record<keyof DataType, string | null>
  );

  // Initialize state for values and errors
  const [values, setValues] = useState<DataType>(initialValues);
  const [errors, setErrors] = useState<Record<keyof DataType, string | null>>(initialErrors);

  /**
   * A function that validates a field based on specified rules.
   *
   * @template Key - The type of field key to be validated.
   * @param {Key} key - The key of the field within the data type to validate.
   * @param {any} value - The value of the field being validated.
   * @returns {string | null} Returns an error message if the validation fails. Returns null if the validation succeeds.
   *
   * Validates if the field is required and checks if the value is undefined, null, or an empty string.
   */
  const validateField = useCallback(
    <Key extends keyof DataType>(key: Key, value: DataType[Key]): string | null => {
      const field = fields[key];
      if (field.required && (value === undefined || value === null || value === "")) {
        return "This field is required.";
      }

      return null;
    },
    [fields]
  );

  // Function to set a field's value
  /**
   * Updates the state for a specific key-value pair within the data object
   * and validates the field, updating errors state accordingly.
   *
   * @function setValue
   * @template Key
   * @param {Key} key - The key of the data object to be updated.
   * @param {any} value - The new value to assign to the specified key.
   * @return {void} - This function does not return a value.
   * @description
   * This function is a generic state updater designed to modify an entry in a data object.
   * It leverages the `setValues` function to update the value of a specified key while
   * preserving other existing data. Additionally, it invokes the `setErrors` function
   * to update the error state based on the validation of the updated field.
   */
  const setValue = useCallback(
    <Key extends keyof DataType>(key: Key, value: DataType[Key]): void => {
      setValues((prev) => ({
        ...prev,
        [key]: value,
      }));
      setErrors((prev) => ({
        ...prev,
        [key]: validateField(key, value),
      }));
    },
    [validateField]
  );

  // Generate props for form fields
  /**
   * fieldFormProps is a memoized object that maps each key from the fields object
   * to an object containing a value and an onChange handler for form fields.
   *
   * This object is constructed using the keys of the fields object to create
   * a record where each key corresponds to a prop object for a form field.
   * Each prop object contains:
   * - value: The current value of the form field, retrieved from the values object.
   * - onChange: A function that updates the value of the form field in the
   *   parent state. This function takes a React ChangeEvent for an HTML input
   *   element and sets the corresponding value in the parent component.
   *
   * Dependencies:
   * - values: A state object that holds the current values of all form fields.
   *
   * The useMemo hook ensures this object is only recalculated when the values
   * dependency changes, optimizing performance by avoiding unnecessary re-renders.
   *
   * Note: The DataType should be a generic type representing the shape of your form
   * data, ensuring type safety during development.
   */
  const fieldFormProps = useMemo(() => {
    return Object.keys(fields).reduce((acc, key) => {
      const typedKey = key as keyof DataType;
      acc[typedKey] = {
        required: fields[typedKey].required,
        value: values[typedKey],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          setValue(typedKey, e.target.value as DataType[typeof typedKey]);
        },
      };
      return acc;
    }, {} as FieldFormProps<DataType>);
  }, [fields, setValue, values]);

  // Determine if the form is valid
  const isFormValid = useMemo(() => {
    return Object.keys(fields).every((key) => !validateField(key as keyof DataType, values[key as keyof DataType]));
  }, [fields, validateField, values]);

  return {
    errors,
    values,
    setValue,
    fieldFormProps,
    isFormValid,
  };
}
