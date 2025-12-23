import { FieldDefinition, FieldType } from "./types";
import {
  SensitivePersonalData,
  SensitivePersonalDataEncryptionPayload,
  StoredPersonalInfo,
} from "src/sensitiveData/types";

/**
 * Converts sensitive personal data to an encryption payload.
 *
 * @param data - The sensitive personal data object
 * @param fields - The field definitions that describe the data structure
 * @returns An encryption payload with the sensitive data
 */
export const toEncryptionPayload = (
  data: SensitivePersonalData,
  fields: FieldDefinition[]
): SensitivePersonalDataEncryptionPayload => {
  const result: SensitivePersonalDataEncryptionPayload = {};

  fields.forEach((field) => {
    if (data[field.name] !== undefined) {
      result[field.dataKey] = data[field.name];
    }
  });

  return result;
};

/**
 * Creates an empty sensitive personal data object with default values for each field.
 *
 * @param fields - The field definitions that describe the data structure
 * @returns An empty SensitivePersonalData object with default values
 */
export const createEmptySensitivePersonalData = (fields: FieldDefinition[]): SensitivePersonalData => {
  const result: SensitivePersonalData = {};

  fields.forEach((field) => {
    if (field.type === FieldType.MultipleSelect) {
      // For multiple selection fields, always use an empty array
      result[field.name] = [];
    } else if (field.type === FieldType.Enum) {
      // For enum fields, use the default value or empty string
      result[field.name] = field.defaultValue ?? "";
    } else {
      // For string and number fields, use the default value or empty string
      result[field.name] = field.defaultValue ?? "";
    }
  });

  return result;
};

/**
 * Extracts personal information from sensitive data in a safe way.
 * This function handles the extraction of fullName, phoneNumber, and contactEmail
 * from the sensitive data, checking if the fields exist in the data.
 *
 * @param sensitiveData - The sensitive personal data object
 * @param fields - The field definitions that describe the data structure
 * @returns A StoredPersonalInfo object with the extracted information
 */
export const extractPersonalInfo = (
  sensitiveData: SensitivePersonalData,
  fields: FieldDefinition[]
): StoredPersonalInfo => {
  // Create a set of available field names for quick lookup
  const availableFields = new Set(fields.map((field) => field.name));

  // Extract full name
  let fullName = "";

  // Check if we have firstName and lastName fields
  const firstName =
    availableFields.has("firstName") && typeof sensitiveData["firstName"] === "string"
      ? sensitiveData["firstName"].trim()
      : "";
  const lastName =
    availableFields.has("lastName") && typeof sensitiveData["lastName"] === "string"
      ? sensitiveData["lastName"].trim()
      : "";
  if (firstName && lastName) {
    fullName = `${firstName} ${lastName}`;
  } else if (firstName) {
    fullName = firstName;
  } else if (lastName) {
    fullName = lastName;
  } else if (availableFields.has("name") && typeof sensitiveData["name"] === "string") {
    fullName = sensitiveData["name"].trim();
  }

  // Extract phone number
  let phoneNumber = "";
  if (availableFields.has("phoneNumber") && typeof sensitiveData["phoneNumber"] === "string") {
    phoneNumber = sensitiveData["phoneNumber"].trim();
  }

  // Extract contact email
  let contactEmail = "";
  if (availableFields.has("contactEmail") && typeof sensitiveData["contactEmail"] === "string") {
    contactEmail = sensitiveData["contactEmail"].trim();
  } else if (availableFields.has("email") && typeof sensitiveData["email"] === "string") {
    // Try alternative field name
    contactEmail = sensitiveData["email"].trim();
  }

  return {
    fullName,
    phoneNumber,
    contactEmail,
  };
};

export function isValidRegex(pattern: string) {
  try {
    new RegExp(pattern); // Try constructing a regex
    return true;
  } catch (e) {
    return false;
  }
}
