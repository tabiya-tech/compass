import { encryptEventsPayload } from 'src/metrics/utils/encryption';
import * as jwtDecodeModule from "jwt-decode"
import { webcrypto } from "crypto";
import MD5 from "crypto-js/md5";

function xorDecrypt(encryptedHex: string, key: string) {
  let encryptedBytes = [];

  // Convert hex string back to bytes
  for (let i = 0; i < encryptedHex.length; i += 2) {
    encryptedBytes.push(parseInt(encryptedHex.substring(i, i+2), 16));
  }

  let decryptedChars = [];
  for (let i = 0; i < encryptedBytes.length; i++) {
    const keyChar = key[i % key.length];
    const decryptedChar = String.fromCharCode(encryptedBytes[i] ^ keyChar.charCodeAt(0));
    decryptedChars.push(decryptedChar);
  }

  return JSON.parse(decryptedChars.join('')); // Convert back to object
}

describe('encryptEventsPayload util function', () => {
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

  it("should be able to decrypt data that can be encrypted", () => {
    // GIVEN some sample content
    const givenEvents  = [{eventType: 1}]

    // AND some sample user token
    const givenUserToken = "bar"

    // AND jwtDecode will be able to decode given token.
    const givenSub = "givenSub"
    const givenIat = 1
    const givenExp = 2
    jest.spyOn(jwtDecodeModule, "jwtDecode").mockReturnValue({sub: givenSub, iat: givenIat, exp: givenExp})

    // WHEN encrypting the given content
    const encryptedContent = encryptEventsPayload(givenEvents, givenUserToken)

    // AND the content is decrypted again
    const decryptedContent = xorDecrypt(encryptedContent, MD5([givenSub, givenIat, givenExp].join('')).toString())

    // THEN the decrypted content should be the same as the given content.
    expect(decryptedContent).toEqual(givenEvents)
  })
});
