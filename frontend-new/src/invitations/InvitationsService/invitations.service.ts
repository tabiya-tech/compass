import { getServiceErrorFactory } from "src/error/error";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/error.constants";
import { getBackendUrl } from "src/envService";
import { fetchWithAuth } from "src/utils/fetchWithAuth/fetchWithAuth";
import { Invitation, InvitationStatus } from "./invitations.types";

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
   * @returns {Promise<Invitation>} - A promise that resolves to an invitation object.
   */
  async checkInvitationCodeStatus(code: string): Promise<Invitation> {
    const serviceName = "InvitationsService";
    const serviceFunction = "checkInvitationCodeStatus";
    const method = "GET";
    const endpointUrl = `${this.invitationStatusEndpointUrl}/check-status?code=${code}`;
    const errorFactory = getServiceErrorFactory(serviceName, serviceFunction, method, endpointUrl);

    const response = await fetchWithAuth(endpointUrl, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: [StatusCodes.OK],
      serviceName: serviceName,
      serviceFunction: serviceFunction,
      failureMessage: `Failed to check status for invitation code ${code}`,
    });

    const responseBody = await response.text();
    let data: Invitation;

    try {
      data = JSON.parse(responseBody);
    } catch (e: any) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        {
          responseBody,
          error: e,
        }
      );
    }

    if (data.status !== InvitationStatus.VALID) {
      throw errorFactory(
        StatusCodes.UNPROCESSABLE_ENTITY,
        ErrorConstants.ErrorCodes.FORBIDDEN,
        "Invitation code is not valid",
        {}
      );
    }
    // TODO: Here we also need to check if the invitation is expired
    return data;
  }
}

export const invitationsService = InvitationsService.getInstance();
