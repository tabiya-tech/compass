import "src/_test_utilities/consoleMock";

import InvitationsService from "./invitations.service";
import { StatusCodes } from "http-status-codes";
import { ServiceError } from "src/error/ServiceError/ServiceError";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import ErrorConstants from "src/error/ServiceError/ServiceError.constants";
import { Invitation, InvitationStatus, InvitationType } from "./invitations.types";

const setupFetchSpy = setupAPIServiceSpy;

describe("InvitationsService", () => {
  // GIVEN a backend URL is returned by the envService
  let givenApiServerUrl: string = "/path/to/api";
  beforeEach(() => {
    jest.spyOn(require("src/envService"), "getBackendUrl").mockReturnValue(givenApiServerUrl);
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  test("should construct the service successfully", () => {
    // GIVEN the service is constructed
    const service = new InvitationsService();

    // THEN expect the service to be constructed successfully
    expect(service).toBeDefined();

    // AND the service should have the correct endpoint URL
    expect(service.invitationStatusEndpointUrl).toEqual(`${givenApiServerUrl}/user-invitations`);
  });

  describe("checkInvitationCodeStatus", () => {
    test("should fetch at the correct URL, with GET and the correct headers and payload successfully", async () => {
      // GIVEN the GET invitations REST API will respond with OK and a valid status
      const givenCode = "test-code";
      const givenResponseBody: Invitation = {
        invitation_code: givenCode,
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.REGISTER,
      };

      const fetchSpy = setupFetchSpy(StatusCodes.OK, givenResponseBody, "application/json;charset=UTF-8");

      // WHEN the checkInvitationCodeStatus function is called with the given code
      const service = new InvitationsService();
      let actualStatus;
      await service.checkInvitationCodeStatus(
        "test-code",
        (data) => {
          actualStatus = data;
        },
        (error) => {
          throw error;
        }
      );

      // THEN expect it to make a GET request with correct headers and payload
      expect(fetchSpy).toHaveBeenCalledWith(
        `${givenApiServerUrl}/user-invitations/check-status?invitation_code=test-code`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          expectedStatusCode: [200],
          failureMessage: `Failed to check status for invitation code test-code`,
          serviceFunction: "checkInvitationCodeStatus",
          serviceName: "InvitationsService",
        }
      );

      // AND expect it to return the valid invitation object
      expect(actualStatus).toEqual(givenResponseBody);
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenFetchError = new Error();
      jest.spyOn(require("src/utils/fetchWithAuth/fetchWithAuth"), "fetchWithAuth").mockRejectedValue(givenFetchError);

      // WHEN calling checkInvitationCodeStatus function with some code
      const service = new InvitationsService();

      // THEN expected it to reject with the error response
      let error;
      try {
        await service.checkInvitationCodeStatus(
          "test-code",
          () => {},
          (err) => {
            throw err;
          }
        );
      } catch (err) {
        error = err;
      }

      // AND expect the service to throw the error that the fetchWithAuth function throws
      expect(error).toEqual(new Error("Failed to check status for invitation code"));
    });

    test.each([
      ["is a malformed json", "{"],
      ["is a string", "foo"],
    ])(
      "on 200, should reject with an error ERROR_CODE.INTERNAL_SERVER_ERROR if response %s",
      async (description, givenResponse) => {
        // GIVEN the GET invitations REST API will respond with OK and some invalid response
        setupFetchSpy(StatusCodes.OK, givenResponse, "application/json;charset=UTF-8");

        // WHEN the checkInvitationCodeStatus function is called with the given code
        const service = new InvitationsService();

        // THEN expected it to reject with the error response
        const expectedError = {
          ...new ServiceError(
            InvitationsService.name,
            "checkInvitationCodeStatus",
            "GET",
            `${givenApiServerUrl}/user-invitations/check-status?invitation_code=test-code`,
            StatusCodes.INTERNAL_SERVER_ERROR,
            ErrorConstants.ErrorCodes.INTERNAL_SERVER_ERROR,
            "",
            ""
          ),
          details: expect.anything(),
        };
        let error;
        try {
          await service.checkInvitationCodeStatus(
            "test-code",
            () => {},
            (err) => {
              throw err;
            }
          );
        } catch (err) {
          error = err;
        }
        expect(error).toMatchObject(expectedError);
        // AND expect error to be service error
        expect(error).toBeInstanceOf(ServiceError);
      }
    );
  });
});
