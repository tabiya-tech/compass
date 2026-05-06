import { getRestAPIErrorFactory, type RestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { customFetch } from "src/utils/customFetch/customFetch";
import { getBackendUrl } from "src/envService";
import i18n from "src/i18n/i18n";
import type { TranslationKey } from "src/react-i18next";
import type {
  ModuleListResponse,
  ModuleDetail,
  ModuleSummary,
  CareerReadinessConversationResponse,
  CareerReadinessConversationInput,
  QuizResponse,
  QuizSubmissionResponse,
} from "src/careerReadiness/types";

const SERVICE_NAME = "CareerReadinessService";
const OVERRIDE_MODULE_TITLE_KEYS_BY_ORDER: Record<number, TranslationKey> = {
  1: "careerReadiness.moduleTitles.professionalIdentity",
  2: "careerReadiness.moduleTitles.cvDevelopment",
  3: "careerReadiness.moduleTitles.coverLetterMotivation",
  4: "careerReadiness.moduleTitles.interviewPreparation",
  5: "careerReadiness.moduleTitles.workplaceReadiness",
  6: "careerReadiness.moduleTitles.entrepreneurship",
};

function applyModuleTitleOverride<T extends ModuleSummary>(module: T): T {
  const overrideTitleKey = OVERRIDE_MODULE_TITLE_KEYS_BY_ORDER[module.sort_order];
  if (!overrideTitleKey) return module;
  return {
    ...module,
    title: i18n.t(overrideTitleKey),
  };
}

function parseJson<T>(responseBody: string, errorFactory: RestAPIErrorFactory): T {
  try {
    return JSON.parse(responseBody) as T;
  } catch (e: unknown) {
    throw errorFactory(0, ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY, "Response did not contain valid JSON", {
      responseBody,
      error: e,
    });
  }
}

export default class CareerReadinessService {
  private static instance: CareerReadinessService;
  private readonly baseUrl: string;

  private constructor() {
    this.baseUrl = `${getBackendUrl()}/career-readiness`;
  }

  static getInstance(): CareerReadinessService {
    if (!CareerReadinessService.instance) {
      CareerReadinessService.instance = new CareerReadinessService();
    }
    return CareerReadinessService.instance;
  }

  async listModules(): Promise<ModuleListResponse> {
    const url = `${this.baseUrl}/modules`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "listModules", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "listModules",
      failureMessage: "Failed to list career readiness modules",
      expectedContentType: "application/json",
      retryOnFailedToFetch: true,
    });
    const body = await response.text();
    const parsed = parseJson<ModuleListResponse>(body, errorFactory);
    return {
      ...parsed,
      modules: parsed.modules.map((module) => applyModuleTitleOverride(module)),
    };
  }

  async getModule(moduleId: string): Promise<ModuleDetail> {
    const url = `${this.baseUrl}/modules/${encodeURIComponent(moduleId)}`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getModule", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getModule",
      failureMessage: `Failed to get module ${moduleId}`,
      expectedContentType: "application/json",
      retryOnFailedToFetch: true,
    });
    const body = await response.text();
    const parsed = parseJson<ModuleDetail>(body, errorFactory);
    return applyModuleTitleOverride(parsed);
  }

  async createConversation(moduleId: string): Promise<CareerReadinessConversationResponse> {
    const url = `${this.baseUrl}/modules/${encodeURIComponent(moduleId)}/conversations`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "createConversation", "POST", url);
    const response = await customFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.CREATED,
      serviceName: SERVICE_NAME,
      serviceFunction: "createConversation",
      failureMessage: `Failed to create conversation for module ${moduleId}`,
      expectedContentType: "application/json",
    });
    const body = await response.text();
    return parseJson<CareerReadinessConversationResponse>(body, errorFactory);
  }

  async getConversationHistory(moduleId: string, conversationId: string): Promise<CareerReadinessConversationResponse> {
    const url = `${this.baseUrl}/modules/${encodeURIComponent(moduleId)}/conversations/${encodeURIComponent(conversationId)}/messages`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getConversationHistory", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getConversationHistory",
      failureMessage: `Failed to get conversation history for module ${moduleId}`,
      expectedContentType: "application/json",
      retryOnFailedToFetch: true,
    });
    const body = await response.text();
    return parseJson<CareerReadinessConversationResponse>(body, errorFactory);
  }

  async sendMessage(
    moduleId: string,
    conversationId: string,
    userInput: string
  ): Promise<CareerReadinessConversationResponse> {
    const url = `${this.baseUrl}/modules/${encodeURIComponent(moduleId)}/conversations/${encodeURIComponent(conversationId)}/messages`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "sendMessage", "POST", url);
    const body: CareerReadinessConversationInput = { user_input: userInput };
    const response = await customFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      expectedStatusCode: StatusCodes.CREATED,
      serviceName: SERVICE_NAME,
      serviceFunction: "sendMessage",
      failureMessage: `Failed to send message in module ${moduleId}`,
      expectedContentType: "application/json",
    });
    const responseBody = await response.text();
    return parseJson<CareerReadinessConversationResponse>(responseBody, errorFactory);
  }

  async getQuiz(moduleId: string, conversationId: string): Promise<QuizResponse> {
    const url = `${this.baseUrl}/modules/${encodeURIComponent(moduleId)}/conversations/${encodeURIComponent(conversationId)}/quiz`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getQuiz", "GET", url);
    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getQuiz",
      failureMessage: `Failed to get quiz for module ${moduleId}`,
      expectedContentType: "application/json",
      retryOnFailedToFetch: true,
    });
    const body = await response.text();
    return parseJson<QuizResponse>(body, errorFactory);
  }

  async submitQuiz(
    moduleId: string,
    conversationId: string,
    answers: Record<string, string>
  ): Promise<QuizSubmissionResponse> {
    const url = `${this.baseUrl}/modules/${encodeURIComponent(moduleId)}/conversations/${encodeURIComponent(conversationId)}/quiz`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "submitQuiz", "POST", url);
    const response = await customFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "submitQuiz",
      failureMessage: `Failed to submit quiz for module ${moduleId}`,
      expectedContentType: "application/json",
    });
    const body = await response.text();
    return parseJson<QuizSubmissionResponse>(body, errorFactory);
  }
}
