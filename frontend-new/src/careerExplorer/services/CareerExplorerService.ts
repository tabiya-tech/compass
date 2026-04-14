import { StatusCodes } from "http-status-codes";
import { customFetch } from "src/utils/customFetch/customFetch";
import { getBackendUrl } from "src/envService";
import { getRestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import type { CareerExplorerConversationResponse, CareerExplorerConversationInput } from "src/careerExplorer/types";

export interface UserSectorEngagementItem {
  sector_name: string;
  is_priority: boolean;
  inquiry_count: number;
  last_asked_at: string | null;
}

export interface UserSectorEngagementResponse {
  data: UserSectorEngagementItem[];
  meta: { total_sectors: number };
}

const SERVICE_NAME = "CareerExplorerService";

export default class CareerExplorerService {
  private static instance: CareerExplorerService;
  private readonly baseUrl: string;

  private constructor() {
    this.baseUrl = `${getBackendUrl()}/career-explorer`;
  }

  static getInstance(): CareerExplorerService {
    if (!CareerExplorerService.instance) {
      CareerExplorerService.instance = new CareerExplorerService();
    }
    return CareerExplorerService.instance;
  }

  async getOrCreateConversation(): Promise<CareerExplorerConversationResponse> {
    const url = `${this.baseUrl}/conversation`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getOrCreateConversation", "POST", url);
    const response = await customFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: [StatusCodes.OK, StatusCodes.CREATED],
      serviceName: SERVICE_NAME,
      serviceFunction: "getOrCreateConversation",
      failureMessage: "Failed to start career explorer conversation",
      expectedContentType: "application/json",
    });
    const body = await response.text();
    try {
      return JSON.parse(body) as CareerExplorerConversationResponse;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        responseBody: body,
        error: e,
      });
    }
  }

  async sendMessage(userInput: string): Promise<CareerExplorerConversationResponse> {
    const url = `${this.baseUrl}/conversation/messages`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "sendMessage", "POST", url);
    const body: CareerExplorerConversationInput = { user_input: userInput };
    const response = await customFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      expectedStatusCode: StatusCodes.CREATED,
      serviceName: SERVICE_NAME,
      serviceFunction: "sendMessage",
      failureMessage: "Failed to send message",
      expectedContentType: "application/json",
    });
    const responseBody = await response.text();
    try {
      return JSON.parse(responseBody) as CareerExplorerConversationResponse;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        responseBody,
        error: e,
      });
    }
  }

  async getSectorEngagementForUser(): Promise<UserSectorEngagementResponse> {
    const url = `${getBackendUrl()}/analytics/sector-engagement/me`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getSectorEngagementForUser", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getSectorEngagementForUser",
      failureMessage: "Failed to fetch sector engagement",
      expectedContentType: "application/json",
      retryOnFailedToFetch: true,
    });
    const body = await response.text();
    try {
      return JSON.parse(body) as UserSectorEngagementResponse;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        responseBody: body,
        error: e,
      });
    }
  }

  async getConversation(): Promise<CareerExplorerConversationResponse> {
    const url = `${this.baseUrl}/conversation`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getConversation", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getConversation",
      failureMessage: "Failed to get conversation",
      expectedContentType: "application/json",
      retryOnFailedToFetch: true,
    });
    const body = await response.text();
    try {
      return JSON.parse(body) as CareerExplorerConversationResponse;
    } catch (e) {
      throw errorFactory(response.status, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Invalid JSON", {
        responseBody: body,
        error: e,
      });
    }
  }
}
