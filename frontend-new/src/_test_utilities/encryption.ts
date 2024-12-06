import { webcrypto as crypto } from "crypto";
import { EncryptionConfig } from "src/sensitiveData/config/encryptionConfig";

export async function generateRSACryptoPairKey() {
  return await crypto.subtle.generateKey(
    {
      name: EncryptionConfig.RSA.ALGORITHM,
      modulusLength: EncryptionConfig.RSA.KEY_SIZE,
      // 3 is a common exponent in practice
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: EncryptionConfig.RSA.KEY_HASH_FN,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  // @ts-ignore
  const binary = String.fromCharCode(...new Uint8Array(buffer));

  return Buffer.from(binary, "binary").toString("base64");
}

export async function exportCryptoPublicKey(key: CryptoKey) {
  const exported = await crypto.subtle.exportKey("spki", key);
  const base64String = arrayBufferToBase64(exported);
  return `-----BEGIN PUBLIC KEY-----\n${base64String}\n-----END PUBLIC KEY-----`;
}

export async function decryptWithRSA(privateKey: CryptoKey, data: ArrayBuffer) {
  return await crypto.subtle.decrypt(
    {
      name: EncryptionConfig.RSA.ALGORITHM,
    },
    privateKey,
    data
  );
}

export async function decryptWithAES(encryptedData: ArrayBuffer, iv: ArrayBuffer, key: ArrayBuffer) {
  try {
    const importedKey = await crypto.subtle.importKey("raw", key, EncryptionConfig.AES.ALGORITHM, true, ["decrypt"]);

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
