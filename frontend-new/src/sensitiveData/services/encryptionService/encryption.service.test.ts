// mute the console
import "src/_test_utilities/consoleMock";
import { webcrypto } from "crypto";

import {
  getRandomLorem,
  getRandomString,
  getTestString,
  getThreeBytesUTF8Char,
} from "src/_test_utilities/specialCharacters";
import { EncryptionService } from "src/sensitiveData/services/encryptionService/encryption.service";
import {
  decryptWithAES,
  decryptWithRSA,
  exportCryptoPublicKey,
  generateRSACryptoPairKey,
} from "src/_test_utilities/encryption";
import { SensitivePersonalDataEncryptionPayload } from "src/sensitiveData/types";

import * as EnvServiceModule from "src/envService";
import {
  EncryptionConfig,
  MaximumAESEncryptedDataSize,
  MaximumAESEncryptedKeySize,
} from "src/sensitiveData/services/encryptionConfig";

// For testing, we'll use hardcoded max lengths
// IMPORTANT: The backend has a limit on the size of the data it accepts.
// This constant represents the maximum size of data we want to test with.
// The actual field structure is determined by the configuration and is not relevant for these tests.
// TODO: rethink
const MAX_FIELD_LENGTH = 100;
const MAX_FIELDS_COUNT = 10;

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
    // GIVEN some random sensitive personal data
    const givenRandomData: Record<string, any> = {
      field1: getTestString(50),
      field2: getThreeBytesUTF8Char(50),
      field3: getRandomString(50),
      field4: getRandomLorem(50),
      field5: getRandomLorem(50),
    };

    // AND in the environment we have a given key_id
    const givenKeyId = getTestString(256);
    jest.spyOn(EnvServiceModule, "getSensitivePersonalDataRSAEncryptionKeyId").mockReturnValue(givenKeyId);

    // AND a public key based on the maximum RSA key size assumed by the backend.
    const keyPair = await generateRSACryptoPairKey(2048);
    const givenPublicKey = await exportCryptoPublicKey(keyPair.publicKey);
    jest.spyOn(EnvServiceModule, "getSensitivePersonalDataRSAEncryptionKey").mockReturnValue(givenPublicKey);

    // WHEN encrypting the sensitive personal data
    const encryptionService = new EncryptionService();
    const encryptedSensitivePersonalData = await encryptionService.encryptSensitivePersonalData(
      givenRandomData as SensitivePersonalDataEncryptionPayload
    );

    // THEN the encrypted data should be returned
    expect(encryptedSensitivePersonalData).toBeDefined();
    expect(encryptedSensitivePersonalData.rsa_key_id).toBe(givenKeyId);
    expect(encryptedSensitivePersonalData.aes_encrypted_data).toBeDefined();
    expect(encryptedSensitivePersonalData.aes_encryption_key).toBeDefined();

    // AND the encrypted data should be decryptable
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
    const actualPersonalData = JSON.parse(new TextDecoder().decode(actualDecryptedData));
    expect(actualPersonalData).toEqual(givenRandomData);
  });

  test(`should encrypt sensitive data with the maximum allowed size`, async () => {
    // IMPORTANT: This test verifies that data at the maximum allowed size can be encrypted
    // without exceeding the backend's limits. The actual field structure is not relevant.

    // GIVEN a sensitive personal data object with the maximum possible size
    // Create a large object with many fields at maximum length to test the size limits
    const givenMaxSensitivePersonalData: Record<string, any> = {};

    // Add multiple fields with maximum length to simulate a worst-case scenario
    for (let i = 0; i < MAX_FIELDS_COUNT; i++) {
      givenMaxSensitivePersonalData[`field${i}`] = getThreeBytesUTF8Char(MAX_FIELD_LENGTH);
    }

    // AND in the environment we have a given key_id
    const givenKeyId = getTestString(256);
    jest.spyOn(EnvServiceModule, "getSensitivePersonalDataRSAEncryptionKeyId").mockReturnValue(givenKeyId);

    // AND a public key based on the maximum RSA key size assumed by the backend.
    const keyPair = await generateRSACryptoPairKey(4096);
    const givenPublicKey = await exportCryptoPublicKey(keyPair.publicKey);
    jest.spyOn(EnvServiceModule, "getSensitivePersonalDataRSAEncryptionKey").mockReturnValue(givenPublicKey);

    // WHEN encrypting the sensitive personal data
    const encryptionService = new EncryptionService();
    const encryptedSensitivePersonalData = await encryptionService.encryptSensitivePersonalData(
      givenMaxSensitivePersonalData as SensitivePersonalDataEncryptionPayload
    );

    // THEN the encrypted data should be returned
    expect(encryptedSensitivePersonalData).toBeDefined();

    // AND not exceed the maximum expected length
    expect(encryptedSensitivePersonalData.aes_encrypted_data.length).toBeLessThanOrEqual(MaximumAESEncryptedDataSize);
    expect(encryptedSensitivePersonalData.aes_encryption_key.length).toBeLessThanOrEqual(MaximumAESEncryptedKeySize);

    // AND the data should be decryptable
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

    const iv = decryptedData.slice(0, EncryptionConfig.AES.IV_LEN);
    const encryptedData = decryptedData.slice(EncryptionConfig.AES.IV_LEN);

    const actualDecryptedData = await decryptWithAES(encryptedData, iv, actualEncryptionKey);
    const actualPersonalData = JSON.parse(new TextDecoder().decode(actualDecryptedData));

    // Verify the decrypted data matches the original
    expect(actualPersonalData).toEqual(givenMaxSensitivePersonalData);
  });
});
