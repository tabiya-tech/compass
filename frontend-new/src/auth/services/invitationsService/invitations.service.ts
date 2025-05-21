import { StatusCodes } from "http-status-codes";
import { getBackendUrl } from "src/envService";
import { Invitation } from "./invitations.types";
import { customFetch } from "src/utils/customFetch/customFetch";

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
   * @throws {RestAPIError} If the invitation code is invalid
   */
  async checkInvitationCodeStatus(code: string): Promise<Invitation> {
    const serviceName = "InvitationsService";
    const serviceFunction = "checkInvitationCodeStatus";
    const method = "GET";
    const endpointUrl = `${this.invitationStatusEndpointUrl}/check-status?invitation_code=${code}`;
      const response = await customFetch(endpointUrl, {
        method: method,
        expectedStatusCode: StatusCodes.OK,
        serviceName: serviceName,
        serviceFunction: serviceFunction,
        failureMessage: `Failed to check status for invitation code ${code}`,
        authRequired: false
      });

      const responseBody = await response.text();
      let data: Invitation;

      data = JSON.parse(responseBody);

      return data;
  }
}

export const invitationsService = InvitationsService.getInstance();
