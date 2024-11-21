import { EncryptedSensitivePersonalData } from "src/sensitiveData/services/encryptionService/types";

/**
 * Error thrown when the encrypted personal data exceeds the acceptable size.
 * */
export class EncryptedDataTooLarge extends Error {
  constructor(encryptSensitivePersonalData: EncryptedSensitivePersonalData) {
    const actual_length = {
      aes_encrypted_data_length: encryptSensitivePersonalData.aes_encrypted_data.length,
      aes_encryption_key_length: encryptSensitivePersonalData.aes_encryption_key.length,
      rsa_key_id_length: encryptSensitivePersonalData.rsa_key_id.length,
    };

    super(`Encrypted data is too large:${JSON.stringify(actual_length)}`);
    this.name = "EncryptedDataTooLarge";
  }
}
