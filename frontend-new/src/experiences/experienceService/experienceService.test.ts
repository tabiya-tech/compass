// mute the console
import "src/_test_utilities/consoleMock";

import ExperienceService from "src/experiences/experienceService/experienceService";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { expectCorrectFetchRequest, setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { StatusCodes } from "http-status-codes";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import { mockExperiences } from "src/experiences/experienceService/_test_utilities/mockExperiencesResponses";

describe("ExperienceService", () => {
  let givenApiServerUrl: string = "/path/to/api";
  beforeEach(() => {
    jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);
  });

  test("should construct the service successfully", () => {
    // GIVEN the service is constructed
    const service = ExperienceService.getInstance();

    // THEN expect the service to be constructed successfully
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ExperienceService);

    // AND the service should have the correct endpoint url
    expect(service.experiencesEndpointUrl).toEqual(`${givenApiServerUrl}/conversations`);
  });

  describe("getExperiences", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test.each([
      ["unedited experiences", true, false],
      ["processed experiences", false, true],
    ])(
      "should fetch the correct URL with GET and the correct headers and payload successfully for %s",
      async (_description, unedited, include_deleted) => {
        // GIVEN the experiences to return
        const givenMockExperiences = { mockExperiences };
        const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, givenMockExperiences, "application/json;charset=UTF-8");

        // WHEN the getExperiences function is called with a session id
        const givenSessionId = 1234;
        const service = ExperienceService.getInstance();
        const experiencesResponse = await service.getExperiences(givenSessionId, unedited, include_deleted);

        // THEN expect to make a GET request with the correct headers and payload
        expectCorrectFetchRequest(
          fetchSpy,
          `${givenApiServerUrl}/conversations/${givenSessionId}/experiences?unedited=${unedited}&include_deleted=${include_deleted}`,
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
      }
    );

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
      const service = ExperienceService.getInstance();

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
        const service = ExperienceService.getInstance();
        const actualExperience = service.getExperiences(givenSessionId);

        // THEN expect it to reject with the error response
        const expectedError = {
          ...new RestAPIError(
            ExperienceService.name,
            "getExperiences",
            "GET",
            `${givenApiServerUrl}/conversations/${givenSessionId}/experiences?unedited=false&include_deleted=false`,
            StatusCodes.OK,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          cause: expect.anything(),
        };
        await expect(actualExperience).rejects.toMatchObject(expectedError);
      }
    );
  });

  describe("updateExperience", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should fetch the correct URL, with PATCH and the correct headers and payload successfully", async () => {
      // GIVEN an experience with only updated fields
      const experienceId = mockExperiences[0].UUID;
      const updatedFields = {
        experience_title: "foo Title",
        company: "bar Company",
      };
      const updatedExperience = { ...mockExperiences[0], ...updatedFields };

      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, updatedExperience, "application/json;charset=UTF-8");

      // WHEN the updateExperience function is called with the updated fields
      const givenSessionId = 1234;
      const service = ExperienceService.getInstance();
      const result = await service.updateExperience(givenSessionId, experienceId, updatedFields);

      // THEN expect to make a PATCH request with the updated fields
      expectCorrectFetchRequest(
        fetchSpy,
        `${givenApiServerUrl}/conversations/${givenSessionId}/experiences/${experienceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedFields),
          expectedStatusCode: StatusCodes.OK,
          serviceName: "ExperienceService",
          serviceFunction: "updateExperience",
          failureMessage: `Failed to update experience with UUID ${experienceId}`,
          expectedContentType: "application/json",
        }
      );
      // AND to return the complete updated experience
      expect(result).toEqual(updatedExperience);
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN the updateExperience function is called
      const givenSessionId = 1234;
      const experienceId = mockExperiences[0].UUID;
      const updatedFields = { experience_title: "Updated Title" };
      const service = ExperienceService.getInstance();

      // THEN expect it to reject with the expected error
      await expect(service.updateExperience(givenSessionId, experienceId, updatedFields)).rejects.toThrow(
        givenFetchError
      );
    });

    test.each([
      ["is a malformed json", "#"],
      ["is a string", "foo"],
    ])(
      "on 200, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (_description, giveResponse) => {
        // GIVEN fetch resolves with a response that has invalid JSON
        setupAPIServiceSpy(StatusCodes.OK, giveResponse, "application/json;charset=UTF-8");
        // AND the updated fields
        const givenSessionId = 1234;
        const experienceId = mockExperiences[0].UUID;
        const updatedFields = { experience_title: "foo Title" };

        // WHEN the updateExperience function is called
        const service = ExperienceService.getInstance();
        const actualExperience = service.updateExperience(givenSessionId, experienceId, updatedFields);

        // THEN expect it to reject with the error response
        const expectedError = {
          ...new RestAPIError(
            ExperienceService.name,
            "updateExperience",
            "PATCH",
            `${givenApiServerUrl}/conversations/${givenSessionId}/experiences/${experienceId}`,
            StatusCodes.OK,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          cause: expect.anything(),
        };
        await expect(actualExperience).rejects.toMatchObject(expectedError);
      }
    );
  });

  describe("deleteExperience", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should  delete the experience successfully", async () => {
      // GIVEN an experience to delete
      const experienceId = mockExperiences[0].UUID;
      // AND the session id for the experience
      const givenSessionId = 1234;
      // AND the API will return a successful response
      const fetchSpy = setupAPIServiceSpy(StatusCodes.NO_CONTENT, undefined, "a");

      // WHEN the deleteExperience function is called
      const service = ExperienceService.getInstance();
      await service.deleteExperience(givenSessionId, experienceId);

      // THEN expect to make a DELETE request with the correct URL
      expectCorrectFetchRequest(
        fetchSpy,
        `${givenApiServerUrl}/conversations/${givenSessionId}/experiences/${experienceId}`,
        {
          method: "DELETE",
          expectedStatusCode: StatusCodes.NO_CONTENT,
          serviceName: "ExperienceService",
          serviceFunction: "deleteExperience",
          failureMessage: `Failed to delete experience with UUID ${experienceId}`,
        }
      );
      // AND expect no errors or warnings to be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should throw the same error thrown by the customFetch method", async () => {
      // GIVEN an experience to delete
      const experienceId = mockExperiences[0].UUID;
      // AND the session id for the experience
      const givenSessionId = 1234;
      // AND the API will return an error response
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN the deleteExperience function is called
      const service = ExperienceService.getInstance();

      // THEN expect the correct error to be thrown
      await expect(service.deleteExperience(givenSessionId, experienceId)).rejects.toThrow(givenFetchError);
      // AND expect no errors or warnings to be logged
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe("getUneditedExperience", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should fetch the correct URL, with GET and the correct headers and payload successfully", async () => {
      // GIVEN the experience to return
      const givenMockExperience = mockExperiences[0];
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, givenMockExperience, "application/json;charset=UTF-8");

      // WHEN the getExperiences function is called with a session id
      const givenSessionId = 1234;
      const service = ExperienceService.getInstance();
      const experiencesResponse = await service.getUneditedExperience(givenSessionId, givenMockExperience.UUID);

      // THEN expect to make a GET request with the correct headers and payload
      expectCorrectFetchRequest(
        fetchSpy,
        `${givenApiServerUrl}/conversations/${givenSessionId}/experiences/${givenMockExperience.UUID}/unedited`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          expectedStatusCode: StatusCodes.OK,
          serviceName: "ExperienceService",
          serviceFunction: "getUneditedExperience",
          failureMessage: "Failed to retrieve experience with UUID " + givenMockExperience.UUID,
          expectedContentType: "application/json",
        }
      );
      // AND to return the correct experiences
      expect(experiencesResponse).toEqual(givenMockExperience);
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN the updateExperience function is called
      const givenSessionId = 1234;
      const experienceId = mockExperiences[0].UUID;
      const service = ExperienceService.getInstance();

      // THEN expect it to reject with the expected error
      await expect(service.getUneditedExperience(givenSessionId, experienceId)).rejects.toThrow(givenFetchError);
    });

    test.each([
      ["is a malformed json", "#"],
      ["is a string", "foo"],
    ])(
      "on 200, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (_description, giveResponse) => {
        // GIVEN fetch resolves with a response that has invalid JSON
        setupAPIServiceSpy(StatusCodes.OK, giveResponse, "application/json;charset=UTF-8");
        // AND the updated fields
        const givenSessionId = 1234;
        const experienceId = mockExperiences[0].UUID;

        // WHEN the updateExperience function is called
        const service = ExperienceService.getInstance();
        const actualExperience = service.getUneditedExperience(givenSessionId, experienceId);

        // THEN expect it to reject with the error response
        const expectedError = {
          ...new RestAPIError(
            ExperienceService.name,
            "getUneditedExperience",
            "GET",
            `${givenApiServerUrl}/conversations/${givenSessionId}/experiences/${experienceId}/unedited`,
            StatusCodes.OK,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          cause: expect.anything(),
        };
        await expect(actualExperience).rejects.toMatchObject(expectedError);
      }
    );
  });

  describe("restoreDeletedExperience", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should restore a deleted experience successfully", async () => {
      // GIVEN an experience to restore
      const experienceId = mockExperiences[0].UUID;
      // AND the session id for the experience
      const givenSessionId = 1234;
      // AND the API will return a successful response
      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, mockExperiences[0], "application/json;charset=UTF-8");

      // WHEN the restoreDeletedExperience function is called
      const service = ExperienceService.getInstance();
      await service.restoreDeletedExperience(givenSessionId, experienceId);

      // THEN expect to make a POST request with the correct URL
      expectCorrectFetchRequest(
        fetchSpy,
        `${givenApiServerUrl}/conversations/${givenSessionId}/experiences/${experienceId}/restore`,
        {
          method: "POST",
          expectedStatusCode: StatusCodes.OK,
          serviceName: "ExperienceService",
          serviceFunction: "restoreExperience",
          failureMessage: `Failed to restore experience with UUID ${experienceId}`,
        }
      );
    });

    test("should throw the same error thrown by the customFetch method", async () => {
      // GIVEN an experience to restore
      const experienceId = mockExperiences[0].UUID;
      // AND the session id for the experience
      const givenSessionId = 1234;
      // AND the API will return an error response
      const givenFetchError = new Error("some error");
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockImplementationOnce(() => {
        return new Promise(() => {
          throw givenFetchError;
        });
      });

      // WHEN the restoreDeletedExperience function is called
      const service = ExperienceService.getInstance();

      // THEN expect the correct error to be thrown
      await expect(service.restoreDeletedExperience(givenSessionId, experienceId)).rejects.toThrow(givenFetchError);
    });

    test.each([
      ["is a malformed json", "#"],
      ["is a string", "foo"],
    ])(
      "on 200, should reject with an error ERROR_CODE.INVALID_RESPONSE_BODY if response %s",
      async (_description, giveResponse) => {
        // GIVEN fetch resolves with a response that has invalid JSON
        setupAPIServiceSpy(StatusCodes.OK, giveResponse, "application/json;charset=UTF-8");
        // AND the updated fields
        const givenSessionId = 1234;
        const experienceId = mockExperiences[0].UUID;

        // WHEN the restoreDeletedExperience function is called
        const service = ExperienceService.getInstance();
        const actualExperience = service.restoreDeletedExperience(givenSessionId, experienceId);

        // THEN expect it to reject with the error response
        const expectedError = {
          ...new RestAPIError(
            ExperienceService.name,
            "restoreDeletedExperience",
            "POST",
            `${givenApiServerUrl}/conversations/${givenSessionId}/experiences/${experienceId}/restore`,
            StatusCodes.OK,
            ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
            "",
            ""
          ),
          cause: expect.anything(),
        };
        await expect(actualExperience).rejects.toMatchObject(expectedError);
      }
    );
  });
});
