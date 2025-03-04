import { StatusCodes } from "http-status-codes";
import { customFetch } from "src/utils/customFetch/customFetch";
import { getBackendUrl } from "src/envService";
import {
  FeedbackItem, FeedbackRequest,
  FeedbackResponse,
} from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import InfoService from "src/info/info.service";
import authStateService from "src/auth/services/AuthenticationState.service";
import { getRestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";

export default class OverallFeedbackService {
  readonly feedbackEndpointUrl: string;
  readonly apiServerUrl: string;
  private readonly sessionId: number;

  constructor(sessionId: number) {
    this.apiServerUrl = getBackendUrl();
    this.feedbackEndpointUrl = `${this.apiServerUrl}/conversations/${sessionId}/feedback`;
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
    const method = "PATCH";
    const feedbackURL = this.feedbackEndpointUrl;
    const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, method, feedbackURL);

    const user = authStateService.getInstance().getUser();
    if (!user?.id) {
      throw new Error("User not found");
    }

    const infoService = new InfoService();
    const [frontendInfo] = await infoService.loadInfo();
    const versionString = `${frontendInfo.branch}-${frontendInfo.buildNumber}`;

    const feedbackRequest: FeedbackRequest = {
      version: {
        frontend: versionString,
      },
      feedback_items_specs: feedback,
    };

    const response = await customFetch(feedbackURL, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(feedbackRequest),
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to send feedback with session id ${this.sessionId}`,
      expectedContentType: "application/json",
    });

    let feedbackResponse : FeedbackResponse;
    try {
      feedbackResponse = JSON.parse(await response.text());
    } catch (e: any) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        {}
      );
    }

    return feedbackResponse;
  }
}
