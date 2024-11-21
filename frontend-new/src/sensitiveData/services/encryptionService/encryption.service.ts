import { EncryptionConfig } from "src/sensitiveData/config/encryptionConfig";
import {
  AESResult,
  EncryptedSensitivePersonalData,
} from "src/sensitiveData/services/encryptionService/types";
import { getSensitivePersonalDataRSAEncryptionKey, getSensitivePersonalDataRSAEncryptionKeyId } from "src/envService";
import { SensitivePersonalData } from "src/sensitiveData/types";

function stringToBytes(str: string): Uint8Array {
  const bufView = new Uint8Array(str.length);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return bufView;
}

/**
 * Encryption service provides methods for encrypting sensitive data.
 */
export class EncryptionService {
  private crypto: Crypto;

  constructor() {
    this.crypto = window.crypto;
  }

  private async extractRSAPublicCryptoKey(publicKeyPEMString: string): Promise<CryptoKey> {
    const publicKeyBase64 = publicKeyPEMString
      .replace(/-----BEGIN PUBLIC KEY-----/, "")
      .replace(/-----END PUBLIC KEY-----/, "")
      .replace(/\n/g, "");

    const publicKeyDecoded = window.atob(publicKeyBase64);

    const publicKeyBytes = stringToBytes(publicKeyDecoded);

    return await this.crypto.subtle.importKey(
      EncryptionConfig.RSA.FORMAT,
      publicKeyBytes,
      {
        name: EncryptionConfig.RSA.ALGORITHM,
        hash: EncryptionConfig.RSA.KEY_HASH_FN,
      },
      true, // Is extractable
      ["encrypt"], // used for encryption here
    );
  }

  private async encryptWithAES(plainText: string): Promise<AESResult> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(plainText);

    const cryptoKey = await this.crypto.subtle.generateKey(
      {
        name: EncryptionConfig.AES.ALGORITHM,
        length: EncryptionConfig.AES.KEY_LEN,
      },
      true,
      ["encrypt", "decrypt"],
    );

    // the length is 12 bytes because we are using AES-GCM, and it is recommended to use 96 bytes = 12 bytes * 8 bits.
    const randomIV = this.crypto.getRandomValues(new Uint8Array(EncryptionConfig.AES.IV_LEN));

    const encryptedData = await this.crypto.subtle.encrypt(
      {
        name: EncryptionConfig.AES.ALGORITHM,
        iv: randomIV,
        tagLength: EncryptionConfig.AES.TAG_LEN,
      },
      cryptoKey,
      dataBuffer,
    );

    const encryptionKey = await this.crypto.subtle.exportKey(EncryptionConfig.AES.FORMAT, cryptoKey);

    return {
      encryptedData: encryptedData,
      encryptionKey: new Uint8Array(encryptionKey),
      initializationVector: randomIV,
    };
  }

  private uint8ArrayToBase64(...uint8Arrays: Uint8Array[]): string {
    // join all Uint8Arrays into one
    const combinedArray = new Uint8Array(uint8Arrays.reduce((acc, curr) => acc + curr.length, 0));

    let offset = 0;
    for (const array of uint8Arrays) {
      combinedArray.set(array, offset);
      offset += array.length;
    }

    // Convert the Uint8Array to a binary string
    const binString = Array.from(combinedArray, (byte) => String.fromCodePoint(byte)).join("");
    return btoa(binString);
  }

  public async encryptSensitivePersonalData(
    personalData: SensitivePersonalData,
  ): Promise<EncryptedSensitivePersonalData> {
    // Load the public key and key_id from the environment.
    // AND load the cryptoKey from the public key.
    const rsa_key_id = getSensitivePersonalDataRSAEncryptionKeyId();

    const publicKey = getSensitivePersonalDataRSAEncryptionKey();
    const cryptoKey = await this.extractRSAPublicCryptoKey(publicKey);


    // convert the personal data to a string
    const personalDataString = JSON.stringify(personalData);

    // encrypt the personal data with AES
    const aesResult = await this.encryptWithAES(personalDataString);

    // encrypt the AES encryption key with the RSA public key
    const encryptedKey = await this.crypto.subtle.encrypt(
      {
        name: EncryptionConfig.RSA.ALGORITHM,
      },
      cryptoKey,
      aesResult.encryptionKey,
    );

    // construct the response object
    const aes_encrypted_data = this.uint8ArrayToBase64(
      aesResult.initializationVector,
      new Uint8Array(aesResult.encryptedData),
    );

    const aes_encryption_key = this.uint8ArrayToBase64(new Uint8Array(encryptedKey));

    return {
      rsa_key_id,
      aes_encrypted_data,
      aes_encryption_key,
    };
  }
}
