// mute the console
import "src/_test_utilities/consoleMock";
import { webcrypto } from "crypto";

import { getRandomLorem, getRandomString, getTestString, getThreeBytesUTF8Char } from "src/_test_utilities/specialCharacters";
import {
  EncryptionService,
} from "src/sensitiveData/services/encryptionService/encryption.service";
import {
  decryptWithAES,
  decryptWithRSA,
  exportCryptoPublicKey,
  generateRSACryptoPairKey,
} from "src/_test_utilities/encryption";
import { Gender, SensitivePersonalData } from "src/sensitiveData/types";

import * as EnvServiceModule from "src/envService";
import {
  EncryptionConfig,
  MaximumAESEncryptedDataSize,
  MaximumAESEncryptedKeySize,
} from "src/sensitiveData/config/encryptionConfig";

import { formConfig } from "src/sensitiveData/components/sensitiveDataForm/formConfig";

describe("EncryptionService", () => {

  beforeAll(() => {
    // The window.crypto is not available in the jest test environment.
    // So we need to mock it.
    Object.defineProperty(window, "crypto", {
      value: webcrypto,
      configurable: true, // This is needed to make the property writable, so that cleanup can be done.
    });
  });
  afterAll(() => {
    Object.defineProperty(window, "crypto", {
      value: undefined,
    });
  });

  test(`should encrypt sensitive data and it is possible to decrypt the data again`, async () => {
    // GIVEN some sensitive personal data
    const givenRandomData: SensitivePersonalData = {
      contact_email: getTestString(100),
      first_name: getThreeBytesUTF8Char(100),
      last_name: getTestString(100),
      phone_number: getRandomString(100),
      address: getRandomString(100),
      gender: Gender.PREFER_NOT_TO_SAY,
    };

    // AND in the environment we have a public key and given key_id.
    // AND the EnvServiceFunctions will return the given values.
    const keyPair = await generateRSACryptoPairKey(2048);
    const givenKeId = getRandomLorem(10);
    const givenPublicKey = await exportCryptoPublicKey(keyPair.publicKey);

    jest.spyOn(EnvServiceModule, "getSensitivePersonalDataRSAEncryptionKeyId").mockReturnValue(givenKeId);
    jest.spyOn(EnvServiceModule, "getSensitivePersonalDataRSAEncryptionKey").mockReturnValue(givenPublicKey);

    // WHEN we encrypt the sensitive data using the encryption service
    const encryptionService = new EncryptionService();
    const encryptedSensitivePersonalData = await encryptionService.encryptSensitivePersonalData(givenRandomData);

    // AND we try to decrypt the data again
    const actualEncryptionKey = await decryptWithRSA(
      keyPair.privateKey,
      new Uint8Array(
        [...atob(encryptedSensitivePersonalData.aes_encryption_key).split("")].map((char) => char.charCodeAt(0)),
      ),
    );

    const decryptedData = new Uint8Array(
      // @ts-ignore
      [...atob(encryptedSensitivePersonalData.aes_encrypted_data)].map((char) => char.charCodeAt(0)),
    );

    // 1. differentiate the initialization vector and the encrypted data
    const iv = decryptedData.slice(0, EncryptionConfig.AES.IV_LEN);
    const encryptedData = decryptedData.slice(EncryptionConfig.AES.IV_LEN);

    const actualDecryptedData = await decryptWithAES(encryptedData, iv, actualEncryptionKey);

    // THEN the decrypted data should match the original data
    const actualPersonalData = JSON.parse(new TextDecoder().decode(actualDecryptedData));
    expect(actualPersonalData).toEqual(givenRandomData);
  });

  test("should return encrypted data that do not exceed the maximum expected length given the maximum sensitive personal data object size", async () => {
    // The backend has a limit on the size of the data it accepts.
    // The information can be found here Backend/app/users/sensitive_personal_data/types.py:SensitivePersonalDataBaseModel

    // GIVEN a sensitive personal data object with the size on the edge of the maximum size.
    const givenMaxSensitivePersonalData: SensitivePersonalData = {
      contact_email: getThreeBytesUTF8Char(formConfig.contact_email.maxLength!),
      first_name: getThreeBytesUTF8Char(formConfig.first_name.maxLength!),
      last_name: getThreeBytesUTF8Char(formConfig.last_name.maxLength!),
      phone_number: getThreeBytesUTF8Char(formConfig.phone_number.maxLength!),
      address: getThreeBytesUTF8Char(formConfig.address.maxLength!),
      gender: Gender.PREFER_NOT_TO_SAY, //this is the largest possible value for now
    };

    // AND in the environment we have a given key_id
    const givenKeyId = getTestString(256);
    jest.spyOn(EnvServiceModule, "getSensitivePersonalDataRSAEncryptionKeyId").mockReturnValue(givenKeyId);

    // AND a public key based on the maximum RSA key size assumed by the backend.
    const keyPair = await generateRSACryptoPairKey(4096);
    const givenPublicKey = await exportCryptoPublicKey(keyPair.publicKey);
    jest.spyOn(EnvServiceModule, "getSensitivePersonalDataRSAEncryptionKey").mockReturnValue(givenPublicKey);

    // WHEN encrypting the sensitive personal data
    const encryptionService = new EncryptionService();
    const encryptedSensitivePersonalData = await encryptionService
      .encryptSensitivePersonalData(givenMaxSensitivePersonalData as SensitivePersonalData);

    // THEN the encrypted data should be returned
    expect(encryptedSensitivePersonalData).toBeDefined();

    // AND not exceed the maximum expected length
    expect(encryptedSensitivePersonalData.aes_encryption_key.length).toBeLessThanOrEqual(MaximumAESEncryptedKeySize);

    // AND not exceed the maximum expected length
    expect(encryptedSensitivePersonalData.aes_encrypted_data.length).toBeLessThan(MaximumAESEncryptedDataSize);
  });
});
