// mute the console
import "src/_test_utilities/consoleMock";
import { sensitivePersonalDataService, SensitivePersonalDataSkipError } from "./sensitivePersonalData.service";

import * as CustomFetchModule from "src/utils/customFetch/customFetch";
import { getRandomLorem, getRandomString } from "src/_test_utilities/specialCharacters";
import {
  MaximumAESEncryptedDataSize,
  MaximumAESEncryptedKeySize,
  MaximumRSAKeyIdSize,
} from "src/sensitiveData/services/encryptionConfig";
import { EncryptionService } from "src/sensitiveData/services/encryptionService/encryption.service";
import { EncryptedDataTooLarge } from "./errors";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { FieldDefinition, FieldType } from "src/sensitiveData/components/sensitiveDataForm/config/types";

// Define gender values as constants to match the mockConfig
const Gender = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  OTHER: "OTHER",
  PREFER_NOT_TO_SAY: "PREFER_NOT_TO_SAY",
};

// Mock config for testing
const mockConfig: FieldDefinition[] = [
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
  {
    name: "address",
    dataKey: "address",
    type: FieldType.String,
    required: true,
    label: "Address",
  },
  {
    name: "gender",
    dataKey: "gender",
    type: FieldType.Enum,
    required: false,
    label: "Gender",
    values: ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"],
    defaultValue: "PREFER_NOT_TO_SAY",
  },
];

describe("SensitivePersonalDataService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createSensitivePersonalData", () => {
    test("should create the correct data to the backend", async () => {
      // GIVEN the encryption service returns the expected data
      const givenEncryptReturnValue = {
        rsa_key_id: "given_key_id",
        aes_encrypted_data: "given_encrypted_data",
        aes_encryption_key: "given_encryption_key",
      };
      const encryptSensitivePersonalData = jest
        .spyOn(EncryptionService.prototype, "encryptSensitivePersonalData")
        .mockResolvedValue(givenEncryptReturnValue);

      const savePersonalDataInLocalStorage = jest.spyOn(PersistentStorageService, "setPersonalInfo");

      // AND some sample sensitive personal data
      const givenSensitivePersonalData = {
        contactEmail: "contact_email",
        firstName: "first_name",
        lastName: "last_name",
        phoneNumber: "phone_number",
        address: "address",
        gender: Gender.PREFER_NOT_TO_SAY,
      };

      // AND some random user id
      const givenUserId = getRandomLorem(10);

      // AND the custom fetch function resolves
      const customFetch = jest.spyOn(CustomFetchModule, "customFetch").mockResolvedValue(new Response());

      // WHEN we create the sensitive personal data
      await sensitivePersonalDataService.createSensitivePersonalData(
        givenSensitivePersonalData,
        givenUserId,
        mockConfig
      );

      // THEN savePersonalDataInLocalStorage should be called with the correct parameters
      expect(savePersonalDataInLocalStorage).toHaveBeenCalledWith({
        fullName: givenSensitivePersonalData.firstName + " " + givenSensitivePersonalData.lastName,
        phoneNumber: givenSensitivePersonalData.phoneNumber,
        contactEmail: givenSensitivePersonalData.contactEmail,
      });

      // AND the encryption service is called with the sensitive personal data.
      expect(encryptSensitivePersonalData).toHaveBeenCalledWith({
        first_name: givenSensitivePersonalData.firstName,
        last_name: givenSensitivePersonalData.lastName,
        contact_email: givenSensitivePersonalData.contactEmail,
        phone_number: givenSensitivePersonalData.phoneNumber,
        address: givenSensitivePersonalData.address,
        gender: givenSensitivePersonalData.gender,
      });

      // AND the custom fetch function is called with the correct parameters.
      expect(customFetch).toHaveBeenCalledWith(`/users/${givenUserId}/sensitive-personal-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        expectedStatusCode: [201, 409],
        serviceName: "SensitivePersonalData",
        serviceFunction: "createSensitivePersonalData",
        failureMessage: `Failed to create sensitive personal data for user with id ${givenUserId}`,
        // AND the response got from the encryption service is passed to the custom fetch function.
        body: JSON.stringify({
          sensitive_personal_data: givenEncryptReturnValue,
        }),
        expectedContentType: "application/json",
      });
    });

    test.each([
      ["foo", "bar", "foo bar"],
      ["foo", "", "foo"],
      ["", "bar", "bar"],
      ["", "", ""],
    ])(
      "should format correctly the full name saved in the local storage given the full name is %s and %s",
      async (firstName, lastName, expectedFullName) => {
        // GIVEN the encryption service returns the expected data
        const givenEncryptReturnValue = {
          rsa_key_id: "given_key_id",
          aes_encrypted_data: "given_encrypted_data",
          aes_encryption_key: "given_encryption_key",
        };

        jest
          .spyOn(EncryptionService.prototype, "encryptSensitivePersonalData")
          .mockResolvedValue(givenEncryptReturnValue);
        jest.spyOn(CustomFetchModule, "customFetch").mockResolvedValue(new Response());

        const savePersonalDataInLocalStorage = jest.spyOn(PersistentStorageService, "setPersonalInfo");

        // GIVEN some sample sensitive personal data with the given first name and last name.
        const givenSensitivePersonalData = {
          contactEmail: "contact_email",
          firstName: firstName,
          lastName: lastName,
          phoneNumber: "phone_number",
          address: "address",
          gender: Gender.PREFER_NOT_TO_SAY,
        };

        // AND some random user id
        const givenUserId = getRandomLorem(10);

        // WHEN we create the sensitive personal data
        await sensitivePersonalDataService.createSensitivePersonalData(
          givenSensitivePersonalData,
          givenUserId,
          mockConfig
        );

        // THEN savePersonalDataInLocalStorage should be called with the correct parameters
        expect(savePersonalDataInLocalStorage).toHaveBeenCalledWith({
          fullName: expectedFullName,
          phoneNumber: givenSensitivePersonalData.phoneNumber,
          contactEmail: givenSensitivePersonalData.contactEmail,
        });
      }
    );

    test("should throw an error if the encrypted data is too large", async () => {
      // GIVEN the encryption service returns data that is too large
      const givenEncryptReturnValue = {
        rsa_key_id: getRandomString(MaximumRSAKeyIdSize + 1),
        aes_encrypted_data: getRandomString(MaximumAESEncryptedDataSize + 1),
        aes_encryption_key: getRandomString(MaximumAESEncryptedKeySize + 1),
      };
      jest
        .spyOn(EncryptionService.prototype, "encryptSensitivePersonalData")
        .mockResolvedValue(givenEncryptReturnValue);

      // AND some sample sensitive personal data
      const givenSensitivePersonalData = {
        contactEmail: "contact_email",
        firstName: "first_name",
        lastName: "last_name",
        phoneNumber: "phone_number",
        address: "address",
        gender: Gender.PREFER_NOT_TO_SAY,
      };

      // AND some random user id
      const givenUserId = getRandomLorem(10);

      // WHEN we create the sensitive personal data
      const createSensitivePersonalData = sensitivePersonalDataService.createSensitivePersonalData(
        givenSensitivePersonalData,
        givenUserId,
        mockConfig
      );

      // THEN an error is thrown
      await expect(createSensitivePersonalData).rejects.toThrow(EncryptedDataTooLarge);
    });
  });

  describe("skip", () => {
    test("should construct the skip error class correctly", () => {
      // GIVEN some random error message
      const givenErrorMessage = getRandomLorem(10);

      // WHEN we construct the skip error
      const skipError = new SensitivePersonalDataSkipError(givenErrorMessage);

      // THEN the error message is correct
      expect(skipError.message).toBe(givenErrorMessage);

      // AND the class name is correct
      expect(skipError.name).toBe("SensitivePersonalDataSkipError");
    });

    test("should call the backend with the correct data", async () => {
      // GIVEN some random user id
      const givenUserId = getRandomLorem(10);

      // AND the custom fetch function resolves
      const customFetch = jest.spyOn(CustomFetchModule, "customFetch").mockResolvedValue(new Response());

      // WHEN we skip the sensitive personal data
      await sensitivePersonalDataService.skip(givenUserId);

      // THEN the custom fetch function is called with the correct parameters
      expect(customFetch).toHaveBeenCalledWith(`/users/${givenUserId}/sensitive-personal-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        expectedStatusCode: [201, 409],
        expectedContentType: "application/json",
        failureMessage: `Failed to skip sensitive personal data for user with id ${givenUserId}`,
        body: JSON.stringify({}),
        serviceName: "SensitivePersonalData",
        serviceFunction: "skip",
      });
    });
  });
});
