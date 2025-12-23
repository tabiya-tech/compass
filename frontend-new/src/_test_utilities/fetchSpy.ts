import { ExtendedRequestInit } from "src/utils/customFetch/customFetch";

export function setupFetchSpy(
  expectedStatus: number,
  expectedResponseBody: string | object | undefined,
  contentType: "" | "application/json;charset=UTF-8"
): jest.SpyInstance {
  const responseBody =
    typeof expectedResponseBody === "string" ? expectedResponseBody : JSON.stringify(expectedResponseBody);
  const expectedResponse = new Response(responseBody, {
    status: expectedStatus,
    headers: { "Content-Type": contentType },
  });
  return jest.spyOn(window, "fetch").mockResolvedValue(expectedResponse);
}

// spy on authenticated fetch requests
export function setupAPIServiceSpy(
  expectedStatus: number,
  expectedResponseBody: string | object | undefined | null,
  contentType: string
): jest.SpyInstance {
  const responseBody =
    typeof expectedResponseBody === "string" ? expectedResponseBody : JSON.stringify(expectedResponseBody);
  const expectedResponse = new Response(responseBody, {
    status: expectedStatus,
    headers: { "Content-Type": contentType },
  });

  // Mock the customFetch function to return the expected response
  // Return a clone of the expected response to avoid issues with the original response being consumed
  // Like multiple API calls in the same test.
  return jest
    .spyOn(require("src/utils/customFetch/customFetch"), "customFetch")
    .mockImplementation(async () => expectedResponse.clone());
}

export function expectCorrectFetchRequest(
  fetchSpy: jest.SpyInstance,
  expectedUrl: string,
  expectedConfig: ExtendedRequestInit
) {
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const [actualUrl, actualConfig] = fetchSpy.mock.calls[0];
  expect(actualUrl).toBe(expectedUrl);
  expect(actualConfig.method).toBe(expectedConfig.method);

  // Compare headers if they exist
  if (actualConfig.headers) {
    // Handle headers comparison - convert Headers object to plain object if needed
    const actualHeaders =
      actualConfig.headers instanceof Headers
        ? Object.fromEntries(actualConfig.headers.entries())
        : actualConfig.headers;
    expect(actualHeaders).toEqual(expect.objectContaining(expectedConfig.headers));
  }

  // Compare bodies by parsing JSON if they exist
  if (actualConfig.body && expectedConfig.body) {
    let actualBody: unknown;
    let expectedBody: unknown;

    try {
      actualBody = JSON.parse(JSON.stringify(actualConfig.body));
      expectedBody = JSON.parse(JSON.stringify(expectedConfig.body));
    } catch (e) {
      console.error("Error parsing request bodies:", e);
      throw new Error("Failed to parse request bodies for comparison");
    }
    expect(actualBody).toEqual(expectedBody);
  }

  // Check any extra properties if provided
  type ExtendedConfigKey = keyof ExtendedRequestInit;
  const extraProperties: ExtendedConfigKey[] = [
    "expectedStatusCode",
    "serviceName",
    "serviceFunction",
    "failureMessage",
    "expectedContentType",
  ] as ExtendedConfigKey[];

  extraProperties.forEach((key) => {
    if (expectedConfig[key] !== undefined) {
      expect(actualConfig[key]).toEqual(expectedConfig[key]);
    }
  });
}
