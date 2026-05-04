// mute the console
import "src/_test_utilities/consoleMock";

import JobService from "src/jobMatching/services/JobService";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { expectCorrectFetchRequest, setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { StatusCodes } from "http-status-codes";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import type { MatchedJobApiDocument } from "src/jobMatching/types";

describe("JobService", () => {
  const givenApiServerUrl: string = "/path/to/api";
  beforeEach(() => {
    jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);
  });

  describe("getMatchedJobs", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should fetch GET /jobs/matched with the correct headers and parse the array response", async () => {
      // GIVEN the matched jobs response from the backend
      const givenMatchedJobs: MatchedJobApiDocument[] = [
        {
          uuid: "uuid-1",
          opportunity_title: "Software Engineer",
          location: "Lusaka",
          contract_type: "Full-time",
          URL: "https://example.com/jobs/1",
          final_score: 0.92,
          rank: 1,
          employer: "Acme Corp",
          category: "Engineering",
          posted_date: "2026-04-01",
        },
      ];
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, givenMatchedJobs, "application/json;charset=UTF-8");

      // WHEN getMatchedJobs is called
      const service = JobService.getInstance();
      const actualResponse = await service.getMatchedJobs(20);

      // THEN expect a GET request with the standard service options
      expectCorrectFetchRequest(fetchSpy, `${givenApiServerUrl}/jobs/matched?limit=20`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        expectedStatusCode: StatusCodes.OK,
        serviceName: "JobService",
        serviceFunction: "getMatchedJobs",
        failureMessage: "Failed to fetch matched jobs",
        expectedContentType: "application/json",
        retryOnFailedToFetch: true,
      });
      // AND the parsed array is returned
      expect(actualResponse).toEqual(givenMatchedJobs);
    });

    test("should default the limit to 20 when no argument is provided", async () => {
      // GIVEN the matched endpoint returns an empty array
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, [], "application/json;charset=UTF-8");

      // WHEN getMatchedJobs is called without arguments
      const service = JobService.getInstance();
      await service.getMatchedJobs();

      // THEN the request URL includes limit=20
      expect(fetchSpy.mock.calls[0][0]).toBe(`${givenApiServerUrl}/jobs/matched?limit=20`);
    });

    test("should reject with a RestAPIError when the response body is not valid JSON", async () => {
      // GIVEN the response body is not valid JSON
      setupAPIServiceSpy(StatusCodes.OK, "#malformed#", "application/json;charset=UTF-8");

      // WHEN getMatchedJobs is called
      const service = JobService.getInstance();
      const actualResult = service.getMatchedJobs(20);

      // THEN it rejects with INVALID_RESPONSE_BODY (parseJson uses statusCode=0 to signal a body-parse failure)
      const expectedError = {
        ...new RestAPIError(
          JobService.name,
          "getMatchedJobs",
          "GET",
          `${givenApiServerUrl}/jobs/matched?limit=20`,
          0,
          ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
          "",
          ""
        ),
        cause: expect.anything(),
      };
      await expect(actualResult).rejects.toMatchObject(expectedError);
    });

    test("should propagate the underlying error when fetch rejects", async () => {
      // GIVEN customFetch throws an unexpected error
      const givenFetchError = new Error("network down");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN getMatchedJobs is called
      const service = JobService.getInstance();

      // THEN the error propagates
      await expect(service.getMatchedJobs(20)).rejects.toThrow(givenFetchError);
    });
  });
});
