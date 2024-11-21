import "src/_test_utilities/consoleMock";

import InvitationsService from "./invitations.service";
import { StatusCodes } from "http-status-codes";
import { setupFetchSpy } from "src/_test_utilities/fetchSpy";
import { Invitation, InvitationStatus, InvitationType } from "src/auth/services/invitationsService/invitations.types";
import { SensitivePersonalDataRequirement } from "src/userPreferences/UserPreferencesService/userPreferences.types";

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
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
      };

      const fetchSpy = setupFetchSpy(StatusCodes.OK, givenResponseBody, "application/json;charset=UTF-8");

      // WHEN the checkInvitationCodeStatus function is called with the given code
      const service = new InvitationsService();
      const actualStatus = await service.checkInvitationCodeStatus("test-code");

      // THEN expect it to make a GET request with correct headers and payload
      expect(fetchSpy).toHaveBeenCalledWith(
        `${givenApiServerUrl}/user-invitations/check-status?invitation_code=test-code`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // AND expect it to return the valid invitation object
      expect(actualStatus).toEqual(givenResponseBody);
    });

    test("on fail to fetch, should reject with the expected service error", async () => {
      // GIVEN fetch rejects with some unknown error
      jest.spyOn(require("src/utils/customFetch/customFetch"), "customFetch").mockRejectedValue(new Error());

      // WHEN calling checkInvitationCodeStatus function with some code
      const service = new InvitationsService();

      // THEN expected it to reject with the error response
      const checkInvitationCodeCallback = async () => await service.checkInvitationCodeStatus("test-code");

      // AND expect the service to throw the error that the fetchWithAuth function throws
      await expect(checkInvitationCodeCallback()).rejects.toThrow("Failed to check status for invitation code");
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

        const checkInvitationCodeCallback = async () => await service.checkInvitationCodeStatus("test-code");

        // AND expect the service to throw the error that the fetchWithAuth function throws
        await expect(checkInvitationCodeCallback()).rejects.toThrow("Failed to check status for invitation code");
      }
    );
  });
});
