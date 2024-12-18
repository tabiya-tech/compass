import { webcrypto as crypto } from "crypto";
import { EncryptionConfig } from "src/sensitiveData/config/encryptionConfig";

// Constraining the key size to 2048 or 4096 bits for RSA as the backend expect the 4096 in calculating the maximum size of the encrypted key.
export async function generateRSACryptoPairKey(keySize: 2048 | 4096) {
  return await crypto.subtle.generateKey(
    {
      name: EncryptionConfig.RSA.ALGORITHM,
      modulusLength: keySize,
      // 3 is a common exponent in practice
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: EncryptionConfig.RSA.KEY_HASH_FN,
    },
    true, // Whether the key is extractable (i.e. can be used in exportKey)
    ["encrypt", "decrypt"] // the key can be used for both encryption and decryption
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  // @ts-ignore
  const binary = String.fromCharCode(...new Uint8Array(buffer));

  return Buffer.from(binary, "binary").toString("base64");
}

/**
 * Export a CryptoKey to a PEM formatted string (public key)
 *
 * @param key The CryptoKey to export as a PEM formatted string
 * @returns The PEM formatted string.
 */
export async function exportCryptoPublicKey(key: CryptoKey) {
  // Export the key to ArrayBuffer
  const exported = await crypto.subtle.exportKey(EncryptionConfig.RSA.FORMAT, key);

  const base64String = arrayBufferToBase64(exported);

  // add the PEM header and footer to make it a PEM formatted string.
  return `-----BEGIN PUBLIC KEY-----\n${base64String}\n-----END PUBLIC KEY-----`;
}

/**
 * Decrypt the encrypted data with the private key
 * using RSA Algorithm.
 *
 * @param privateKey
 * @param encryptedData
 */
export async function decryptWithRSA(privateKey: CryptoKey, encryptedData: ArrayBuffer) {
  return await crypto.subtle.decrypt(
    {
      name: EncryptionConfig.RSA.ALGORITHM,
    },
    privateKey,
    encryptedData
  );
}

export async function decryptWithAES(encryptedData: ArrayBuffer, iv: ArrayBuffer, key: ArrayBuffer) {
  try {
    const importedKey = await crypto.subtle.importKey(
      EncryptionConfig.AES.FORMAT,
      key,
      EncryptionConfig.AES.ALGORITHM,
      true,
      ["decrypt"]
    );

    return await crypto.subtle.decrypt(
      {
        name: EncryptionConfig.AES.ALGORITHM,
        iv,
        length: EncryptionConfig.AES.KEY_LEN,
        tagLength: EncryptionConfig.AES.TAG_LEN,
      },
      importedKey,
      encryptedData
    );
  } catch (e) {
    console.error(e);
    throw e;
  }
}
