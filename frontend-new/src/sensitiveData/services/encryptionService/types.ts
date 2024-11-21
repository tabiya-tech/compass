export type AESResult = {
  /**
   * Represents the encrypted data buffer.
   *
   * This variable holds the data that has been encrypted, typically
   * using a cryptographic algorithm. The data is stored in an
   * ArrayBuffer format, which allows for efficient storage and
   * manipulation of raw binary data.
   */
  encryptedData: ArrayBuffer;

  /**
   * The encryption key used for securing sensitive data.
   *
   * It is represented as a Uint8Array to accommodate binary data,
   * ensuring flexibility and compatibility with various encryption algorithms.
   *
   * Use this key carefully and avoid hardcoding it in the source code
   * to prevent potential security risks.
   */
  encryptionKey: Uint8Array;

  /**
   * A cryptographic initialization vector (IV) used by algorith we are using AES-GCM.
   * The IV ensures that the same plaintext will produce different ciphertexts each time it is encrypted.
   * Typically, it is a random or pseudo-random value and should be unique for each encryption operation.
   */
  initializationVector: Uint8Array;
};

export type EncryptedSensitivePersonalData = {
  /**
   * The ID of the RSA key used for encryption.
   */
  rsa_key_id: string;

  /**
   * The encrypted data using AES.
   * combined with authentication tag and IV.
   */
  aes_encrypted_data: string;

  /**
   * The AES encryption key used to decrypt/encrypt the data.
   * It is encrypted using the RSA public key.
   */
  aes_encryption_key: string;
};
