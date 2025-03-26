import { jwtDecode } from "jwt-decode";
import MD5 from "crypto-js/md5";

/**
 * Encrypts the payload using XOR encryption with the given key.
 *
 * @param payload
 * @param key
 */
function xorEncrypt(payload: any, key: string): string {
  const data = JSON.stringify(payload); // Convert payload to string
  let encryptedBytes = [];

  // Iterate over each character in the input data
  for (let i = 0; i < data.length; i++) {
    const keyChar = key[i % key.length]; // Cycle through the key
    const encryptedByte = data.charCodeAt(i) ^ keyChar.charCodeAt(0); // XOR operation
    encryptedBytes.push(encryptedByte);
  }

  return encryptedBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}


/**
 * Encrypts the list of events using XOR encryption using information from the token.
 *
 * @param payload
 * @param token
 */
export function encryptEventsPayload(payload: any, token: string): string {
  // construct the way to get the key used for decrypting, this formula should be the same used as on the frontend
  // for encrypting, otherwise the decryption will not work.
  const decodedToken = jwtDecode(token)
  const keyData = `${decodedToken.sub}${decodedToken.iat}${decodedToken.exp}`

  // md5 the key
  const key = MD5(keyData).toString()

  return xorEncrypt(payload, key)
}
