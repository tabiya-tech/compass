// mute the console
import "src/_test_utilities/consoleMock";
import { browserEncryptionService } from "../encryptionService/encryptionService";
import { Gender } from "./types";
import { sensitivePersonalDataService } from "./sensitivePersonalDataService";

import * as CustomFetchModule from "src/utils/customFetch/customFetch";
import { getRandomString } from "src/_test_utilities/specialCharacters";

describe("SensitivePersonalDataService", () => {
  describe("createSensitivePersonalData", () => {
    test("should create the correct data to the backend", async () => {
      // GIVEN the encryption service returns the expected data
      const givenEncryptReturnValue = {
        rsa_key_id: "given_key_id",
        aes_encrypted_data: "given_encrypted_data",
        aes_encryption_key: "given_encryption_key",
      };
      const encryptSensitivePersonalData = jest
        .spyOn(browserEncryptionService, "encryptSensitivePersonalData")
        .mockResolvedValue(givenEncryptReturnValue);

      // AND some sample sensitive personal data
      const givenSensitivePersonalData = {
        contact_email: "contact_email",
        first_name: "first_name",
        last_name: "last_name",
        phone_number: "phone_number",
        address: "address",
        gender: Gender.PREFER_NOT_TO_SAY,
      };

      // AND some random user id
      const givenUserId = getRandomString(10);

      // AND the custom fetch function resolves
      const customFetch = jest.spyOn(CustomFetchModule, "customFetch").mockResolvedValue(new Response());

      // WHEN we create the sensitive personal data
      await sensitivePersonalDataService.createSensitivePersonalData(givenSensitivePersonalData, givenUserId);

      // THEN the encryption service is called with the sensitive personal data.
      expect(encryptSensitivePersonalData).toHaveBeenCalledWith(givenSensitivePersonalData);

      // AND the custom fetch function is called with the correct parameters.
      expect(customFetch).toHaveBeenCalledWith(`/users/${givenUserId}/sensitive-personal-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        expectedStatusCode: 201,
        serviceName: "SensitivePersonalData",
        serviceFunction: "createSensitivePersonalData",
        failureMessage: `Failed to create sensitive personal data for user with id ${givenUserId}`,
        // AND the response got from the encryption service is passed to the custom fetch function.
        body: JSON.stringify(givenEncryptReturnValue),
        expectedContentType: "application/json",
      });
    });
  });
});
