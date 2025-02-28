type TEncryptionConfig = {
  RSA: {
    /**
     * The cryptographic algorithm used for encryption and decryption.
     */
    ALGORITHM: string;

    /**
     * The cryptographic algorithm used for generating RSA keys
     * @type {string}
     */
    KEY_HASH_FN: string;

    /**
     * The format used for representing public keys.
     * SPKI (Subject Public Key Info) is a standard format for public keys. It is widely used in web applications.
     */
    FORMAT: Exclude<KeyFormat, "jwk">;
  };
  AES: {
    /**
     * The format used for representing symmetric keys.
     */
    FORMAT: Exclude<KeyFormat, "jwk">;
    /**
     * The cryptographic algorithm used for encryption and decryption.
     *
     * @type {string}
     *
     * @description
     * AES ALGORITHM defines the specific AES (Advanced Encryption Standard) algorithm mode
     * to be used. In this case, the mode used is AES-GCM (Galois/Counter Mode).
     * AES-GCM is a mode of operation for symmetric key cryptographic block ciphers that
     * It provides both confidentiality and integrity protection.
     * The AES-GCM algorithm is used to encrypt and decrypt data.
     */
    ALGORITHM: string;

    /**
     * @description
     * The size of the key used for encryption and decryption.
     * The key size is measured in bits, and the value 256 indicates that the key is 256 bits long.
     * A longer key size provides stronger security but requires more computational resources.
     */
    KEY_LEN: number;

    /**
     * @description
     * The size of the authentication tag used for encryption and decryption.
     * AES-GCM produces an authentication tag that is used to verify the integrity of the encrypted data.
     * We are using a 128-bit tag length, the recommended size for AES-GCM.
     */
    TAG_LEN: number;

    /**
     * @description
     * The size of the initialization vector (IV) used for encryption and decryption.
     * The IV is a random or pseudo-random value that is used to ensure that the same plaintext
     * AES-GCM recommends using a 96-bit IV equivalent to 12 bytes.
     */
    IV_LEN: number;
  };
};

/**
 * Configurations for encryption
 */
export const EncryptionConfig: TEncryptionConfig = {
  RSA: {
    ALGORITHM: "RSA-OAEP",
    KEY_HASH_FN: "SHA-256",
    FORMAT: "spki",
  },
  AES: {
    FORMAT: "raw",
    ALGORITHM: "AES-GCM",
    KEY_LEN: 256,
    TAG_LEN: 128,
    IV_LEN: 12,
  },
};

/**
 * The maximum size of the data that can be encrypted with AES.
 * For more information, see the following file:
 *
 * Backend/app/users/sensitive_personal_data/types.py:SensitivePersonalDataBaseModel.aes_encrypted_data
 */
export const MaximumAESEncryptedDataSize = 35_000;

/**
 * The maximum size of the data that can be encrypted with RSA.
 * For more information, see the following file:
 *
 * Backend/app/users/sensitive_personal_data/types.py:SensitivePersonalDataBaseModel.aes_encryption_key
 */
export const MaximumAESEncryptedKeySize = 1000;

/**
 * The maximum size of the RSA key ID.
 */
export const MaximumRSAKeyIdSize = 256;
