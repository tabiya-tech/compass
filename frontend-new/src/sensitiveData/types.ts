export interface StoredPersonalInfo {
  fullName: string;
  phoneNumber: string;
  contactEmail: string;
}

// Union type for all possible field values we can get from each field
// The fields are either strings ( string and enum fields)
// or arrays of strings (multiple selection fields)
export type FieldContentValue = string | string[];

// Generic type for sensitive personal data
export type SensitivePersonalData = {
  [key: string]: FieldContentValue;
};

// Generic type for sensitive personal data encryption payload
export type SensitivePersonalDataEncryptionPayload = {
  [key: string]: FieldContentValue;
};
