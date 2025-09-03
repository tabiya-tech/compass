// mute the console
import "src/_test_utilities/consoleMock";

import CVService from "src/CV/CVService/CVService";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { StatusCodes } from "http-status-codes";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";

describe("CVService", () => {
  let givenApiServerUrl: string = "/path/to/api";
  beforeEach(() => {
    jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should get a single instance successfully", () => {
    // WHEN the service is constructed
    const actualFirstInstance = CVService.getInstance();

    // THEN expect the service to be constructed successfully
    expect(actualFirstInstance).toBeDefined();

    // AND the service should have the correct endpoint urls
    expect(actualFirstInstance.apiServerUrl).toEqual(givenApiServerUrl);
    expect(actualFirstInstance.cvEndpointUrl).toEqual(`${givenApiServerUrl}/users`);

    // AND WHEN the service is constructed again
    const actualSecondInstance = CVService.getInstance();
    expect(actualFirstInstance).toBe(actualSecondInstance);

    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  describe("uploadCV", () => {
    test.each([
      [{ type: "application/pdf", name: "file.pdf" }, "application/pdf"],
      [{ type: "", name: "file.pdf" }, "application/pdf"],
      [{ type: "", name: "file.docx" }, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      [{ type: "", name: "file.txt" }, "text/plain"],
      [{ type: "", name: "file.unknown" }, "application/octet-stream"],
      [{ type: "custom/type", name: "file.txt" }, "custom/type"],
    ])("should fetch the correct URL, with POST and Content-Type %s", async (fileProps, expectedContentType) => {
      // GIVEN some file to upload
      const givenFile = new File(["file content"], fileProps.name, { type: fileProps.type });
      const givenUserId = "user123";
      // AND the upload CV REST API will respond with OK and some message response
      const expectedResponse = {
        message: "CV uploaded successfully",
        experiences_data: ["Experience 1", "Experience 2", "Experience 3"],
      };
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, expectedResponse, "application/json;charset=UTF-8");

      // WHEN the uploadCV function is called with the given arguments
      const service = CVService.getInstance();
      const actualResponse = await service.uploadCV(givenUserId, givenFile);

      // THEN expect it to make a POST request to the correct URL with the correct Content-Type
      expect(fetchSpy).toHaveBeenCalledWith(
        `${givenApiServerUrl}/users/${givenUserId}/cv`,
        expect.objectContaining({
          method: "POST",
          body: givenFile,
          headers: expect.objectContaining({
            Accept: "application/json",
            "Content-Type": expectedContentType,
            "x-filename": fileProps.name,
          }),
          expectedStatusCode: StatusCodes.OK,
          serviceName: "CVService",
          serviceFunction: "uploadCV",
          failureMessage: `Failed to upload CV for user ${givenUserId}`,
          expectedContentType: "application/json",
        })
      );

      // AND expect the response to be as expected
      expect(actualResponse).toEqual(expectedResponse.experiences_data);
      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      const givenFile = new File(["file content"], "test-file.pdf", { type: "application/pdf" });
      const givenUserId = "user123";
      // GIVEN the upload CV REST API will fail to fetch
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN the uploadCV function is called with the given arguments
      const service = CVService.getInstance();

      // THEN expect it to reject with the same error thrown by fetchWithAuth
      await expect(service.uploadCV(givenUserId, givenFile)).rejects.toThrow(givenFetchError);
      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 200, should reject with ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (_description, givenResponse) => {
        // GIVEN a file to upload and a user ID
        const givenFile = new File(["file content"], "test-file.pdf", { type: "application/pdf" });
        const givenUserId = "user123";
        // AND the API spy is set up to return the given response
        setupAPIServiceSpy(StatusCodes.OK, givenResponse, "application/json;charset=UTF-8");

        // WHEN uploadCV is called
        const service = CVService.getInstance();
        const uploadPromise = service.uploadCV(givenUserId, givenFile);

        // THEN it should reject with the error response
        const expectedError = {
          ...new RestAPIError(
            "CVService",
            "uploadCV",
            "POST",
            `${givenApiServerUrl}/users`,
            StatusCodes.OK,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "Response did not contain valid JSON",
            ""
          ),
          cause: expect.anything(),
        };
        await expect(uploadPromise).rejects.toMatchObject(expectedError);

        // AND no errors or warnings should have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      }
    );
  });
});
