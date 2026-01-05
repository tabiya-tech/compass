import "src/_test_utilities/consoleMock";

import InvitationsService from "./invitations.service";
import { StatusCodes } from "http-status-codes";
import { setupAPIServiceSpy } from "src/_test_utilities/fetchSpy";
import { Invitation, InvitationStatus, InvitationType } from "src/auth/services/invitationsService/invitations.types";
import { SensitivePersonalDataRequirement } from "src/userPreferences/UserPreferencesService/userPreferences.types";
import * as CustomFetchModule from "src/utils/customFetch/customFetch";
import { INVITATIONS_PARAM_NAME } from "src/auth/auth.types";

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
        code: givenCode,
        invitation_code: givenCode,
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.REGISTER,
        source: null,
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      };

      const fetchSpy = setupAPIServiceSpy(StatusCodes.OK, givenResponseBody, "application/json;charset=UTF-8");

      // WHEN the checkInvitationCodeStatus function is called with the given code
      const service = new InvitationsService();
      const actualStatus = await service.checkInvitationCodeStatus("test-code");

      // THEN expect it to make a GET request with correct headers and payload
      expect(fetchSpy).toHaveBeenCalledWith(
        `${givenApiServerUrl}/user-invitations/check-status?${INVITATIONS_PARAM_NAME}=test-code`,
        {
          method: "GET",
          authRequired: false,
          expectedStatusCode: 200,
          failureMessage: "Failed to check status for invitation code test-code",
          serviceFunction: "checkInvitationCodeStatus",
          serviceName: "InvitationsService",
          retryOnFailedToFetch: true
        }
      );

      // AND expect it to return the valid invitation object
      expect(actualStatus).toEqual(givenResponseBody);
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      const givenError = new Error("Failed to check status for invitation code");
      jest.spyOn(CustomFetchModule, "customFetch").mockRejectedValue(givenError);

      // WHEN calling checkInvitationCodeStatus function with some code
      const service = new InvitationsService();

      // THEN expected it to reject with the error response
      const checkInvitationCodeCallback = async () => await service.checkInvitationCodeStatus("test-code");

      // AND expect the service to throw the error that the fetchWithAuth function throws
      await expect(checkInvitationCodeCallback()).rejects.toThrow(givenError);
    });

    test.each([
      ["is a malformed json", "{", "Expected property name or '}' in JSON at position 1"],
      ["is a string", "foo", "Unexpected token 'o', \"foo\" is not valid JSON"],
    ])(
      "on 200, should reject with an error ERROR_CODE.INTERNAL_SERVER_ERROR if response %s",
      async (description, givenResponse, expectedError) => {
        // GIVEN the GET invitations REST API will respond with OK and some invalid response
        const mockResponse = new Response(givenResponse, {
          status: StatusCodes.OK,
          headers: { "content-type": "application/json;charset=UTF-8" }
        });
        jest.spyOn(CustomFetchModule, "customFetch").mockResolvedValue(mockResponse);

        // WHEN the checkInvitationCodeStatus function is called with the given code
        const service = new InvitationsService();

        const checkInvitationCodeCallback = async () => await service.checkInvitationCodeStatus("test-code");

        // AND expect the service to throw the error that the fetchWithAuth function throws
        await expect(checkInvitationCodeCallback()).rejects.toThrow(expectedError);
      }
    );
  });
});
