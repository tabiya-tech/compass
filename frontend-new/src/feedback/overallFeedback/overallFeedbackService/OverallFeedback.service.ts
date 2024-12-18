import { getServiceErrorFactory } from "src/error/ServiceError/ServiceError";
import { StatusCodes } from "http-status-codes";
import { customFetch } from "src/utils/customFetch/customFetch";
import { getBackendUrl } from "src/envService";
import {
  FeedbackItem,
  FeedbackResponse,
} from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import ErrorConstants from "src/error/ServiceError/ServiceError.constants";
import InfoService from "src/info/info.service";
import authStateService from "src/auth/services/AuthenticationState.service";

export default class OverallFeedbackService {
  readonly feedbackEndpointUrl: string;
  readonly apiServerUrl: string;
  private readonly sessionId: number;

  constructor(sessionId: number) {
    this.apiServerUrl = getBackendUrl();
    this.feedbackEndpointUrl = `${this.apiServerUrl}/users/feedback`;
    this.sessionId = sessionId;
  }

  /**
   * Get the singleton instance of the OverallFeedbackService.
   * @returns {OverallFeedbackService} The singleton instance of the OverallFeedbackService.
   * @param sessionId The session ID to use for the chat service.
   */
  static getInstance(sessionId: number): OverallFeedbackService {
    return new OverallFeedbackService(sessionId);
  }

  /**
   * Sends feedback to the backend.
   * @param feedback The feedback object adhering to the FeedbackResponse schema.
   * @returns {Promise<FeedbackResponse>} The response from the backend.
   */
  public async sendFeedback(feedback: FeedbackItem[]): Promise<FeedbackResponse> {
    const serviceName = "OverallFeedbackService";
    const serviceFunction = "sendFeedback";
    const method = "POST";
    const feedbackURL = this.feedbackEndpointUrl;
    const errorFactory = getServiceErrorFactory(serviceName, serviceFunction, method, feedbackURL);

    const user = authStateService.getInstance().getUser();
    if (!user?.id) {
      throw new Error("User not found");
    }

    const infoService = new InfoService();
    const [frontendInfo] = await infoService.loadInfo();
    const versionString = `${frontendInfo.branch}-${frontendInfo.buildNumber}`;

    const payload: FeedbackResponse = {
      user_id: user.id,
      session_id: this.sessionId,
      version: {
        frontend: versionString,
      },
      feedback: feedback,
    };

    const response = await customFetch(feedbackURL, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      expectedStatusCode: StatusCodes.CREATED,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to send feedback with session id ${this.sessionId}`,
      expectedContentType: "application/json",
    });

    const responseBody = await response.text();

    try {
      return JSON.parse(responseBody);
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
  }
}
