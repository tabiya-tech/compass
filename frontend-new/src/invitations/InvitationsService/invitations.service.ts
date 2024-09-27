import { getServiceErrorFactory, ServiceError } from "src/error/ServiceError/ServiceError";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/ServiceError/ServiceError.constants";
import { getBackendUrl } from "src/envService";
import { Invitation } from "./invitations.types";

export default class InvitationsService {
  private static instance: InvitationsService;

  readonly invitationStatusEndpointUrl: string;
  readonly apiServerUrl: string;

  constructor() {
    this.apiServerUrl = getBackendUrl();
    this.invitationStatusEndpointUrl = `${this.apiServerUrl}/user-invitations`;
  }

  /**
   * Get the singleton instance of the InvitationsService.
   * @returns {InvitationsService} The singleton instance of the InvitationsService.
   */
  static getInstance(): InvitationsService {
    if (!InvitationsService.instance) {
      InvitationsService.instance = new InvitationsService();
    }
    return InvitationsService.instance;
  }

  /**
   * Checks the status of an invitation code.
   * @param {string} code - The invitation code to check.
   * @returns {Promise<Invitation>}
   * @throws {ServiceError} If the invitation code is invalid
   */
  async checkInvitationCodeStatus(code: string): Promise<Invitation> {
    const serviceName = "InvitationsService";
    const serviceFunction = "checkInvitationCodeStatus";
    const method = "GET";
    const endpointUrl = `${this.invitationStatusEndpointUrl}/check-status?invitation_code=${code}`;
    const errorFactory = getServiceErrorFactory(serviceName, serviceFunction, method, endpointUrl);
    try {
      const response = await fetch(endpointUrl, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
      });

      // check if the server responded with the expected status code
      if (response.status !== StatusCodes.OK) {
        // Server responded with a status code that indicates that the resource was not the expected one
        // The responseBody should be an ErrorResponse but that is not guaranteed e.g. if a gateway in the middle returns a 502,
        // or if the server is not conforming to the error response schema
        const responseBody = await response.text();
        throw errorFactory(
          response.status,
          ErrorConstants.ErrorCodes.API_ERROR,
          "Failed to check status for invitation code",
          responseBody
        );
      }

      // check if the response is in the expected format
      const responseContentType = response.headers.get("Content-Type");
      if (!responseContentType?.includes("application/json")) {
        throw errorFactory(
          response.status,
          ErrorConstants.ErrorCodes.INVALID_RESPONSE_HEADER,
          "Response Content-Type should be 'application/json'",
          `Content-Type header was ${responseContentType}`
        );
      }

      const responseBody = await response.text();
      let data: Invitation;

      data = JSON.parse(responseBody);

      return data;
    } catch (e: unknown) {
      if (e instanceof ServiceError) {
        // if we threw a service error above, we should simply rethrow that
        throw e;
      } else {
        throw errorFactory(
          StatusCodes.INTERNAL_SERVER_ERROR,
          ErrorConstants.ErrorCodes.FAILED_TO_FETCH,
          "Failed to check status for invitation code",
          (e as Error).message
        );
      }
    }
  }
}

export const invitationsService = InvitationsService.getInstance();
