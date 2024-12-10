// mute the console
import "src/_test_utilities/consoleMock";
import { webcrypto } from "crypto";

import { getRandomLorem } from "src/_test_utilities/specialCharacters";
import {
  browserEncryptionService,
  EncryptionService,
} from "src/sensitiveData/services/encryptionService/encryption.service";
import {
  decryptWithAES,
  decryptWithRSA,
  exportCryptoPublicKey,
  generateRSACryptoPairKey,
} from "src/_test_utilities/encryption";
import { Gender, SensitivePersonalData } from "src/sensitiveData/services/sensitivePersonalDataService/types";

import * as EnvServiceModule from "src/envService";
import { EncryptionConfig } from "src/sensitiveData/config/encryptionConfig";

describe("EncryptionService", () => {
  const encryptionService = new EncryptionService({
    crypto: webcrypto as Crypto,
    stringToBuffer: (string: string) => Buffer.from(string, "binary"),
  });

  describe("encryptSensitivePersonalData", () => {
    test(`should encrypt sensitive data that can be decrypted`, async () => {
      // GIVEN some sensitive personal data
      const givenRandomData: SensitivePersonalData = {
        contact_email: getRandomLorem(100),
        first_name: getRandomLorem(20),
        last_name: getRandomLorem(10),
        phone_number: getRandomLorem(20),
        address: getRandomLorem(100),
        gender: Gender.PREFER_NOT_TO_SAY,
      };

      // AND in the environment we have a public key and given key_id.
      // AND the EnvServiceFunctions will return the given values.
      const keyPair = await generateRSACryptoPairKey();
      const givenKeId = getRandomLorem(10);
      const givenPublicKey = await exportCryptoPublicKey(keyPair.publicKey);

      jest.spyOn(EnvServiceModule, "getSensitivePersonalDataRSAEncryptionKeyId").mockReturnValue(givenKeId);
      jest.spyOn(EnvServiceModule, "getSensitivePersonalDataRSAEncryptionKey").mockReturnValue(givenPublicKey);

      // WHEN we encrypt the sensitive data using the encryption service
      const encryptedSensitivePersonalData = await encryptionService.encryptSensitivePersonalData(givenRandomData);

      // AND we try to decrypt the data again
      const actualEncryptionKey = await decryptWithRSA(
        keyPair.privateKey,
        new Uint8Array(
          [...atob(encryptedSensitivePersonalData.aes_encryption_key).split("")].map((char) => char.charCodeAt(0))
        )
      );

      const decryptedData = new Uint8Array(
        // @ts-ignore
        [...atob(encryptedSensitivePersonalData.aes_encrypted_data)].map((char) => char.charCodeAt(0))
      );

      // 1. differentiate the initialization vector and the encrypted data
      const iv = decryptedData.slice(0, EncryptionConfig.AES.IV_LEN);
      const encryptedData = decryptedData.slice(EncryptionConfig.AES.IV_LEN);

      const actualDecryptedData = await decryptWithAES(encryptedData, iv, actualEncryptionKey);

      // THEN the decrypted data should match the original data
      expect(JSON.parse(new TextDecoder().decode(actualDecryptedData))).toMatchObject(givenRandomData);
    });

    describe("string to buffer", () => {
      test("should return the expected buffer and a correct one", async () => {
        // GIVEN some random text
        const givenText = getRandomLorem(100);

        // WHEN the service tries to convert a string to a buffer.
        const actualBuffer = browserEncryptionService.options.stringToBuffer(givenText);

        // THEN the buffer should be the expected buffer
        expect(actualBuffer).toBeInstanceOf(ArrayBuffer);

        // WHEN the buffer is converted to a string
        const actualText = new TextDecoder().decode(actualBuffer);

        // THEN the text should be the expected text
        expect(actualText).toBe(givenText);
      });
    });
  });
});
