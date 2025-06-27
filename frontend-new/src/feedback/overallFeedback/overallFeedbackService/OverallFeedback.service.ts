import { StatusCodes } from "http-status-codes";
import { customFetch } from "src/utils/customFetch/customFetch";
import { getBackendUrl } from "src/envService";
import {
  FeedbackItem,
  FeedbackRequest,
  FeedbackResponse,
} from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import InfoService from "src/info/info.service";
import authStateService from "src/auth/services/AuthenticationState.service";
import { getRestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import { QuestionsConfig } from "src/feedback/overallFeedback/overallFeedbackForm/overallFeedbackForm.types";

export default class OverallFeedbackService {
  readonly apiServerUrl: string;
  private static instance: OverallFeedbackService;

  private constructor() {
    this.apiServerUrl = getBackendUrl();
  }

  /**
   * Get the singleton instance of the OverallFeedbackService.
   * @returns {OverallFeedbackService} The singleton instance of the OverallFeedbackService.
   */
  static getInstance(): OverallFeedbackService {
    if (!OverallFeedbackService.instance) {
      OverallFeedbackService.instance = new OverallFeedbackService();
    }
    return OverallFeedbackService.instance;
  }

  /**
   * Sends feedback to the backend.
   * @param sessionId The session ID for the conversation to send feedback for
   * @param feedback The feedback object adhering to the FeedbackResponse schema.
   * @returns {Promise<FeedbackResponse>} The response from the backend.
   */
  public async sendFeedback(sessionId: number, feedback: FeedbackItem[]): Promise<FeedbackResponse> {
    const serviceName = "OverallFeedbackService";
    const serviceFunction = "sendFeedback";
    const method = "PATCH";
    const feedbackURL = `${this.apiServerUrl}/conversations/${sessionId}/feedback`;
    const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, method, feedbackURL);

    const user = authStateService.getInstance().getUser();
    if (!user?.id) {
      throw new Error("User not found");
    }

    const infoService = InfoService.getInstance();
    const { frontend } = await infoService.loadInfo();
    const versionString = `${frontend.branch}-${frontend.buildNumber}`;

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
      failureMessage: `Failed to send feedback with session id ${sessionId}`,
      expectedContentType: "application/json",
    });

    let feedbackResponse: FeedbackResponse;
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

  /**
   * Retrieves the questions configuration from the backend.
   * @param sessionId The session ID for the conversation to retrieve questions for.
   * @returns {Promise<QuestionsConfig>} The questions configuration.
   */
  public async getQuestionsConfig(sessionId: number): Promise<QuestionsConfig> {
    const serviceName = "OverallFeedbackService";
    const serviceFunction = "getQuestionsConfig";
    const method = "GET";
    const questionsURL = `${this.apiServerUrl}/conversations/${sessionId}/feedback/questions`;
    const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, method, questionsURL);

    const response = await customFetch(questionsURL, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: "Failed to retrieve questions configuration",
      expectedContentType: "application/json",
    });

    try {
      return JSON.parse(await response.text());
    } catch (e: any) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        {}
      );
    }
  }
}
