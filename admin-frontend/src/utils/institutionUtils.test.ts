import { decodeInstitutionId, encodeInstitutionId } from "./institutionUtils";

describe("encodeInstitutionId", () => {
  test("encodes a plain ASCII institution name to padding-less base64url", () => {
    // GIVEN a known institution name
    const givenName = "Copperbelt University";

    // WHEN encoded
    const actual = encodeInstitutionId(givenName);

    // THEN the result matches what the Python backend produces (padding stripped)
    // base64.urlsafe_b64encode(b"Copperbelt University").rstrip(b"=") == b"Q29wcGVyYmVsdCBVbml2ZXJzaXR5"
    expect(actual).toBe("Q29wcGVyYmVsdCBVbml2ZXJzaXR5");
  });

  test("encodes a name containing slashes/pluses into url-safe characters", () => {
    // GIVEN a name whose base64 encoding contains both '+' and '/'
    const givenName = "??>?";

    // WHEN encoded
    const actual = encodeInstitutionId(givenName);

    // THEN the result contains no '+' or '/' (url-safe alphabet only)
    expect(actual).not.toMatch(/[+/]/);
    expect(actual).not.toMatch(/=$/);
  });

  test("round-trips with decodeInstitutionId for a typical TEVETA-style name", () => {
    // GIVEN a representative ASCII institution name with whitespace + punctuation
    const givenName = "Alistair Logistics Zambia Limited";

    // WHEN encoded then decoded
    const actualDecoded = decodeInstitutionId(encodeInstitutionId(givenName));

    // THEN we get the original name back
    expect(actualDecoded).toBe(givenName);
  });
});
