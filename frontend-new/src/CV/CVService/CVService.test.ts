// mute the console
import "src/_test_utilities/consoleMock";

import CVService from "src/CV/CVService/CVService";
import { expectCorrectFetchRequest, setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
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
      // AND the upload CV REST API will respond with OK and the new schema
      const expectedResponse = {
        upload_id: "test-upload-id",
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
          compressRequestBody: false, // File uploads should not be compressed
        })
      );

      // AND expect the response to be mapped to the new return type
      expect(actualResponse).toEqual({ uploadId: expectedResponse.upload_id });
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

  describe("cancelUpload", () => {
    test("should fetch the correct URL with DELETE and return void on success", async () => {
      // GIVEN a user ID and an upload ID
      const givenUserId = "user123";
      const givenUploadId = "upload123";
      // AND the cancelUpload REST API will respond with OK
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, "", "application/json;charset=UTF-8");

      // WHEN the cancelUpload function is called with the given arguments
      const service = CVService.getInstance();
      await service.cancelUpload(givenUserId, givenUploadId);

      // THEN expect it to make a DELETE request to the correct URL
      expectCorrectFetchRequest(fetchSpy, `${givenApiServerUrl}/users/${givenUserId}/cv/${givenUploadId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        expectedStatusCode: StatusCodes.OK,
        serviceName: "CVService",
        serviceFunction: "cancelUpload",
        failureMessage: `Failed to cancel upload ${givenUploadId} for user ${givenUserId}`,
        expectedContentType: "application/json",
      });
      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      // GIVEN a user ID and an upload ID
      const givenUserId = "user123";
      const givenUploadId = "upload123";
      // AND the cancelUpload REST API will fail to fetch
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN the cancelUpload function is called with the given arguments
      const service = CVService.getInstance();

      // THEN expect it to reject with the same error thrown by fetchWithAuth
      await expect(service.cancelUpload(givenUserId, givenUploadId)).rejects.toThrow(givenFetchError);
      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("getUploadStatus", () => {
    test("should fetch the correct URL with GET and return the upload status on success", async () => {
      // GIVEN a user ID and an upload ID
      const givenUserId = "user123";
      const givenUploadId = "upload123";
      // AND the getUploadStatus REST API will respond with OK and the upload status
      const expectedResponse = {
        upload_id: givenUploadId,
        filename: "file.pdf",
        uploaded_at: new Date().toISOString(),
        upload_process_state: "COMPLETED",
        experiences_data: [],
      };
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, expectedResponse, "application/json;charset=UTF-8");

      // WHEN the getUploadStatus function is called with the given arguments
      const service = CVService.getInstance();
      const actualResponse = await service.getUploadStatus(givenUserId, givenUploadId);

      // THEN expect it to make a GET request to the correct URL
      expectCorrectFetchRequest(fetchSpy, `${givenApiServerUrl}/users/${givenUserId}/cv/${givenUploadId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        expectedStatusCode: StatusCodes.OK,
        serviceName: "CVService",
        serviceFunction: "getUploadStatus",
        failureMessage: `Failed to get status for upload ${givenUploadId} for user ${givenUserId}`,
        expectedContentType: "application/json",
      });
      // AND expect the response to be mapped to the expected return type
      expect(actualResponse).toEqual(expectedResponse);
      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      // GIVEN a user ID and an upload ID
      const givenUserId = "user123";
      const givenUploadId = "upload123";
      // AND the getUploadStatus REST API will fail to fetch
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN the getUploadStatus function is called with the given arguments
      const service = CVService.getInstance();

      // THEN expect it to reject with the same error thrown by fetchWithAuth
      await expect(service.getUploadStatus(givenUserId, givenUploadId)).rejects.toThrow(givenFetchError);
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
        // GIVEN a user ID and an upload ID
        const givenUserId = "user123";
        const givenUploadId = "upload123";
        // AND the API spy is set up to return the given response
        setupAPIServiceSpy(StatusCodes.OK, givenResponse, "application/json;charset=UTF-8");

        // WHEN getUploadStatus is called
        const service = CVService.getInstance();
        const actualResponse = service.getUploadStatus(givenUserId, givenUploadId);

        // THEN it should reject with the error response
        const expectedError = {
          ...new RestAPIError(
            "CVService",
            "getUploadStatus",
            "GET",
            `${givenApiServerUrl}/users`,
            StatusCodes.OK,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "Response did not contain valid JSON",
            ""
          ),
          cause: expect.anything(),
        };
        await expect(actualResponse).rejects.toMatchObject(expectedError);
      }
    );
  });

  describe("getAllCVs", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should fetch the correct URL with GET and return the list of CVs on success", async () => {
      // GIVEN a user ID
      const givenUserId = "user123";
      // AND the getAllCVs REST API will respond with OK and a list of CVs
      const expectedResponse = [
        {
          upload_id: "cv1",
          filename: "file1.pdf",
          uploaded_at: new Date().toISOString(),
          upload_process_state: "COMPLETED",
          experiences_data: [],
        },
        {
          upload_id: "cv2",
          filename: "file2.docx",
          uploaded_at: new Date().toISOString(),
          upload_process_state: "PROCESSING",
          experiences_data: [],
        },
      ];
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, expectedResponse, "application/json;charset=UTF-8");

      // WHEN the getAllCVs function is called with the given user ID
      const service = CVService.getInstance();
      const actualResponse = await service.getAllCVs(givenUserId);

      // THEN expect it to make a GET request to the correct URL
      expectCorrectFetchRequest(fetchSpy, `${givenApiServerUrl}/users/${givenUserId}/cv`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        expectedStatusCode: StatusCodes.OK,
        serviceName: "CVService",
        serviceFunction: "getAllCVs",
        failureMessage: `Failed to fetch CVs for user ${givenUserId}`,
        expectedContentType: "application/json",
      });
      // AND expect the response to be mapped to the expected return type
      expect(actualResponse).toEqual(expectedResponse);
      // AND expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      // GIVEN a user ID
      const givenUserId = "user123";
      // AND the getAllCVs REST API will fail to fetch
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN the getAllCVs function is called with the given user ID
      const service = CVService.getInstance();

      // THEN expect it to reject with the same error thrown by fetchWithAuth
      await expect(service.getAllCVs(givenUserId)).rejects.toThrow(givenFetchError);
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
        // GIVEN a user ID
        const givenUserId = "user123";
        // AND the API spy is set up to return the given response
        setupAPIServiceSpy(StatusCodes.OK, givenResponse, "application/json;charset=UTF-8");

        // WHEN getAllCVs is called
        const service = CVService.getInstance();
        const actualResponse = service.getAllCVs(givenUserId);

        // THEN it should reject with the error response
        const expectedError = {
          ...new RestAPIError(
            "CVService",
            "getAllCVs",
            "GET",
            `${givenApiServerUrl}/users/${givenUserId}/cv`,

            StatusCodes.OK,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "Response did not contain valid JSON",
            ""
          ),
          cause: expect.anything(),
        };
        await expect(actualResponse).rejects.toMatchObject(expectedError);
      }
    );
  });
});
