import { getServiceErrorFactory, ServiceError } from "src/error/ServiceError/ServiceError";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/ServiceError/ServiceError.constants";
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
   * @param {Function} succesCallback - Callback to execute on successful invitation code status check.
   * @param {Function} failureCallback - Callback to execute on invitation code status check error.
   * @returns {Promise<void>}
   */
  async checkInvitationCodeStatus(
    code: string,
    succesCallback: (invitation: Invitation) => void,
    failureCallback: (error: ServiceError) => void
  ): Promise<void> {
    const serviceName = "InvitationsService";
    const serviceFunction = "checkInvitationCodeStatus";
    const method = "GET";
    const endpointUrl = `${this.invitationStatusEndpointUrl}/check-status?invitation_code=${code}`;
    const errorFactory = getServiceErrorFactory(serviceName, serviceFunction, method, endpointUrl);
    try {
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

      data = JSON.parse(responseBody);

      if (data.status !== InvitationStatus.VALID) {
        failureCallback(
          errorFactory(
            StatusCodes.UNPROCESSABLE_ENTITY,
            ErrorConstants.ErrorCodes.VALIDATION_ERROR,
            "Invitation code is not valid",
            {
              errorCode: ErrorConstants.ErrorCodes.FORBIDDEN,
            }
          )
        );
        return;
      }

      succesCallback(data);
    } catch (e: any) {
      failureCallback(
        errorFactory(
          StatusCodes.INTERNAL_SERVER_ERROR,
          ErrorConstants.ErrorCodes.INTERNAL_SERVER_ERROR,
          "Failed to check status for invitation code",
          {
            error: e,
          }
        )
      );
      return;
    }
  }
}

export const invitationsService = InvitationsService.getInstance();
