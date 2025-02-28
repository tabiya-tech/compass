import "src/_test_utilities/consoleMock";
import { FieldType, FieldDefinition } from './types';
import { toEncryptionPayload, createEmptySensitivePersonalData, extractPersonalInfo } from './utils';
import { SensitivePersonalData } from 'src/sensitiveData/types';

describe('Config Utilities', () => {
  // Sample fields array for testing
  const sampleFields: FieldDefinition[] = [
    {
      name: 'firstName',
      dataKey: 'first_name',
      type: FieldType.String,
      label: 'First Name',
      required: true,
      validation: {
        pattern: '^[A-Za-z\\s]{2,50}$',
        errorMessage: 'First name should contain only letters and be 2-50 characters long'
      }
    },
    {
      name: 'gender',
      dataKey: 'gender_type',
      type: FieldType.Enum,
      label: 'Gender',
      required: true,
      values: ['Male', 'Female', 'Other'],
      defaultValue: 'Male'
    },
    {
      name: 'skills',
      dataKey: 'user_skills',
      type: FieldType.MultipleSelect,
      label: 'Skills',
      required: false,
      values: ['JavaScript', 'TypeScript', 'React']
    }
  ];

  describe('toEncryptionPayload', () => {
    test('should convert SensitivePersonalData to SensitivePersonalDataEncryptionPayload', () => {
      // GIVEN a SensitivePersonalData object and fields array
      const data: SensitivePersonalData = {
        firstName: 'John',
        gender: 'Male',
        skills: ['JavaScript', 'React']
      };
      
      // WHEN toEncryptionPayload is called
      const result = toEncryptionPayload(data, sampleFields);
      
      // THEN it should return a SensitivePersonalDataEncryptionPayload with correct mappings
      expect(result).toEqual({
        first_name: 'John',
        gender_type: 'Male',
        user_skills: ['JavaScript', 'React']
      });
      
      // AND the original field names should not be in the payload
      expect(result).not.toHaveProperty('firstName');
      expect(result).not.toHaveProperty('gender');
      expect(result).not.toHaveProperty('skills');
    });

    test('should only include defined values in the payload', () => {
      // GIVEN a SensitivePersonalData object with some undefined values
      const data: SensitivePersonalData = {
        firstName: 'John',
        skills: ['JavaScript']
      };
      
      // WHEN toEncryptionPayload is called
      const result = toEncryptionPayload(data, sampleFields);
      
      // THEN it should only include defined values in the payload
      expect(result).toEqual({
        first_name: 'John',
        user_skills: ['JavaScript']
      });
      expect(result).not.toHaveProperty('gender_type');
    });

    test('should map camelCase field names to snake_case dataKeys', () => {
      // GIVEN fields with snake_case dataKeys
      const fieldsWithSnakeCaseDataKeys: FieldDefinition[] = [
        {
          name: 'firstName',
          dataKey: 'first_name',
          type: FieldType.String,
          label: 'First Name',
          required: true
        },
        {
          name: 'lastName',
          dataKey: 'last_name',
          type: FieldType.String,
          label: 'Last Name',
          required: true
        },
        {
          name: 'dateOfBirth',
          dataKey: 'date_of_birth',
          type: FieldType.String,
          label: 'Date of Birth',
          required: false
        }
      ];
      
      const data: SensitivePersonalData = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01'
      };
      
      // WHEN toEncryptionPayload is called with snake_case dataKey mappings
      const result = toEncryptionPayload(data, fieldsWithSnakeCaseDataKeys);
      
      // THEN it should use the snake_case dataKey values as keys in the payload
      expect(result).toEqual({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1990-01-01'
      });
      
      // AND the original camelCase field names should not be in the payload
      expect(result).not.toHaveProperty('firstName');
      expect(result).not.toHaveProperty('lastName');
      expect(result).not.toHaveProperty('dateOfBirth');
    });
  });

  describe('createEmptySensitivePersonalData', () => {
    test('should create an empty SensitivePersonalData object with default values', () => {
      // GIVEN a fields array
      const fields = sampleFields;
      
      // WHEN createEmptySensitivePersonalData is called
      const result = createEmptySensitivePersonalData(fields);
      
      // THEN it should return an empty SensitivePersonalData object with default values
      expect(result).toEqual({
        firstName: '',
        gender: 'Male', // Uses the defaultValue
        skills: [] // Multiple fields get empty arrays
      });
    });

    test('should handle fields with no default values', () => {
      // GIVEN fields with no default values
      const fieldsWithoutDefaults: FieldDefinition[] = [
        {
          name: 'firstName',
          dataKey: 'first_name',
          type: FieldType.String,
          label: 'First Name',
          required: true
        },
        {
          name: 'gender',
          dataKey: 'gender_type',
          type: FieldType.Enum,
          label: 'Gender',
          required: true,
          values: ['Male', 'Female', 'Other']
        }
      ];
      
      // WHEN createEmptySensitivePersonalData is called
      const result = createEmptySensitivePersonalData(fieldsWithoutDefaults);
      
      // THEN it should use empty strings for fields without default values
      expect(result).toEqual({
        firstName: '',
        gender: ''
      });
    });
  });

  describe('extractPersonalInfo', () => {
    // GIVEN a set of field definitions
    const baseFields: FieldDefinition[] = [
      {
        name: "firstName",
        dataKey: "first_name",
        type: FieldType.String,
        required: true,
        label: "First name",
      },
      {
        name: "lastName",
        dataKey: "last_name",
        type: FieldType.String,
        required: true,
        label: "Last name",
      },
      {
        name: "contactEmail",
        dataKey: "contact_email",
        type: FieldType.String,
        required: true,
        label: "Contact email",
      },
      {
        name: "phoneNumber",
        dataKey: "phone_number",
        type: FieldType.String,
        required: true,
        label: "Phone number",
      },
    ];

    test("should extract full name from firstName and lastName", () => {
      // GIVEN sensitive data with firstName and lastName
      const sensitiveData: SensitivePersonalData = {
        firstName: "John",
        lastName: "Doe",
        contactEmail: "john.doe@example.com",
        phoneNumber: "123-456-7890",
      };

      // WHEN extracting personal info
      const result = extractPersonalInfo(sensitiveData, baseFields);

      // THEN it should combine firstName and lastName
      expect(result).toEqual({
        fullName: "John Doe",
        contactEmail: "john.doe@example.com",
        phoneNumber: "123-456-7890",
      });
    });

    test("should handle missing lastName", () => {
      // GIVEN sensitive data with only firstName
      const sensitiveData: SensitivePersonalData = {
        firstName: "John",
        contactEmail: "john@example.com",
        phoneNumber: "123-456-7890",
      };

      // WHEN extracting personal info
      const result = extractPersonalInfo(sensitiveData, baseFields);

      // THEN it should use only firstName
      expect(result).toEqual({
        fullName: "John",
        contactEmail: "john@example.com",
        phoneNumber: "123-456-7890",
      });
    });

    test("should handle missing firstName", () => {
      // GIVEN sensitive data with only lastName
      const sensitiveData: SensitivePersonalData = {
        lastName: "Doe",
        contactEmail: "doe@example.com",
        phoneNumber: "123-456-7890",
      };

      // WHEN extracting personal info
      const result = extractPersonalInfo(sensitiveData, baseFields);

      // THEN it should use only lastName
      expect(result).toEqual({
        fullName: "Doe",
        contactEmail: "doe@example.com",
        phoneNumber: "123-456-7890",
      });
    });

    test("should handle generic name field", () => {
      // GIVEN fields with a generic name field
      const nameFields: FieldDefinition[] = [
        {
          name: "name",
          dataKey: "name",
          type: FieldType.String,
          required: true,
          label: "Name",
        },
        {
          name: "contactEmail",
          dataKey: "contact_email",
          type: FieldType.String,
          required: true,
          label: "Contact email",
        },
        {
          name: "phoneNumber",
          dataKey: "phone_number",
          type: FieldType.String,
          required: true,
          label: "Phone number",
        },
      ];

      // AND sensitive data with a name field
      const sensitiveData: SensitivePersonalData = {
        name: "John Doe",
        contactEmail: "john.doe@example.com",
        phoneNumber: "123-456-7890",
      };

      // WHEN extracting personal info
      const result = extractPersonalInfo(sensitiveData, nameFields);

      // THEN it should use the name field
      expect(result).toEqual({
        fullName: "John Doe",
        contactEmail: "john.doe@example.com",
        phoneNumber: "123-456-7890",
      });
    });

    test("should handle alternative email field", () => {
      // GIVEN fields with an email field instead of contactEmail
      const emailFields: FieldDefinition[] = [
        {
          name: "firstName",
          dataKey: "first_name",
          type: FieldType.String,
          required: true,
          label: "First name",
        },
        {
          name: "lastName",
          dataKey: "last_name",
          type: FieldType.String,
          required: true,
          label: "Last name",
        },
        {
          name: "email",
          dataKey: "email",
          type: FieldType.String,
          required: true,
          label: "Email",
        },
        {
          name: "phoneNumber",
          dataKey: "phone_number",
          type: FieldType.String,
          required: true,
          label: "Phone number",
        },
      ];

      // AND sensitive data with an email field
      const sensitiveData: SensitivePersonalData = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phoneNumber: "123-456-7890",
      };

      // WHEN extracting personal info
      const result = extractPersonalInfo(sensitiveData, emailFields);

      // THEN it should use the email field for contactEmail
      expect(result).toEqual({
        fullName: "John Doe",
        contactEmail: "john.doe@example.com",
        phoneNumber: "123-456-7890",
      });
    });

    test("should handle missing fields", () => {
      // GIVEN sensitive data with missing fields
      const sensitiveData: SensitivePersonalData = {};

      // WHEN extracting personal info
      const result = extractPersonalInfo(sensitiveData, baseFields);

      // THEN it should return empty strings
      expect(result).toEqual({
        fullName: "",
        contactEmail: "",
        phoneNumber: "",
      });
    });

    test("should handle whitespace in fields", () => {
      // GIVEN sensitive data with whitespace
      const sensitiveData: SensitivePersonalData = {
        firstName: "  John  ",
        lastName: "  Doe  ",
        contactEmail: "  john.doe@example.com  ",
        phoneNumber: "  123-456-7890  ",
      };

      // WHEN extracting personal info
      const result = extractPersonalInfo(sensitiveData, baseFields);

      // THEN it should trim whitespace
      expect(result).toEqual({
        fullName: "John Doe",
        contactEmail: "john.doe@example.com",
        phoneNumber: "123-456-7890",
      });
    });

    test("should handle non-string values", () => {
      // GIVEN sensitive data with non-string values
      const sensitiveData: SensitivePersonalData = {
        firstName: ["John"] as unknown as string, // Simulating incorrect type
        lastName: "Doe",
        contactEmail: "john.doe@example.com",
        phoneNumber: "123-456-7890",
      };

      // WHEN extracting personal info
      const result = extractPersonalInfo(sensitiveData, baseFields);

      // THEN it should handle the non-string value safely
      expect(result).toEqual({
        fullName: "Doe", // Only lastName is used because firstName is not a string
        contactEmail: "john.doe@example.com",
        phoneNumber: "123-456-7890",
      });
    });
  });
}); 