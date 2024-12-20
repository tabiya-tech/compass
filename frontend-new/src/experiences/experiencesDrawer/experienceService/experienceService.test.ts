import ExperienceService from "src/experiences/experiencesDrawer/experienceService/experienceService";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { StatusCodes } from "http-status-codes";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import { mockExperiences } from "src/experiences/experiencesDrawer/experienceService/_test_utilities/mockExperiencesResponses";

describe("ExperienceService", () => {
  let givenApiServerUrl: string = "/path/to/api";
  beforeEach(() => {
    jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);
  });

  test("should construct the service successfully", () => {
    // GIVEN the service is constructed
    const service = new ExperienceService();

    // THEN expect the service to be constructed successfully
    expect(service).toBeDefined();

    // AND the service should have the correct endpoint url
    expect(service.experiencesEndpointUrl).toEqual(`${givenApiServerUrl}/conversation/experiences`);
  });

  describe("getExperiences", () => {
    test("should fetch the correct URL with GET and the correct headers and payload successfully", async () => {
      // GIVEN the experiences to return
      const givenMockExperiences = { mockExperiences };
      const fetSpy = setupAPIServiceSpy(StatusCodes.OK, givenMockExperiences, "application/json;charset=UTF-8");

      // WHEN the getExperiences function is called with a session id
      const givenSessionId = 1234;
      const service = new ExperienceService();
      const experiencesResponse = await service.getExperiences(givenSessionId);

      // THEN expect to make a GET request with the correct headers and payload
      expect(fetSpy).toHaveBeenCalledWith(
        `${givenApiServerUrl}/conversation/experiences?session_id=${givenSessionId}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          expectedStatusCode: StatusCodes.OK,
          serviceName: "ExperienceService",
          serviceFunction: "getExperiences",
          failureMessage: "Failed to retrieve experiences",
          expectedContentType: "application/json",
        }
      );
      // AND to return the correct experiences
      expect(experiencesResponse).toEqual(givenMockExperiences);
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN the getExperiences function is called
      const givenSessionId = 1234;
      const service = new ExperienceService();

      // THEN expect it to reject with the expected error
      await expect(service.getExperiences(givenSessionId)).rejects.toThrow(givenFetchError);
    });

    test.each([
      ["is a malformed json", "#"],
      ["is a string", "foo"],
    ])(
      "on 200, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (_description, giveResponse) => {
        // GIVEN fetch returns a 200 status code with a malformed json response
        setupAPIServiceSpy(StatusCodes.OK, giveResponse, "application/json;charset=UTF-8");

        // WHEN the getExperiences function is called
        const givenSessionId = 1234;
        const service = new ExperienceService();
        const actualExperience = service.getExperiences(givenSessionId);

        // THEN expect it to reject with the error response
        const expectedError = {
          ...new RestAPIError(
            ExperienceService.name,
            "getExperiences",
            "GET",
            `${givenApiServerUrl}/conversation/experiences?session_id=${givenSessionId}`,
            StatusCodes.OK,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          details: expect.anything(),
        };
        await expect(actualExperience).rejects.toMatchObject(expectedError);
      }
    );
  });
});
