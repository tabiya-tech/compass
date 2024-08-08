import { getBackendUrl } from "src/envService";
import { getServiceErrorFactory } from "src/error/ServiceError/ServiceError";
import { fetchWithAuth } from "src/utils/fetchWithAuth/fetchWithAuth";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/ServiceError/ServiceError.constants";
import { Experience } from "src/Experiences/ExperienceService/Experiences.types";

export default class ExperienceService {
  readonly experiencesEndpointUrl: string;
  readonly apiServeUrl: string;
  private readonly sessionId: number;

  constructor(sessionId: number) {
    this.apiServeUrl = getBackendUrl();
    this.experiencesEndpointUrl = `${this.apiServeUrl}/conversation/experiences`;
    this.sessionId = sessionId;
  }

  static getInstance(sessionId: number): ExperienceService {
    return new ExperienceService(sessionId);
  }

  public getSessionId(): number {
    return this.sessionId;
  }

  async getExperiences(): Promise<Experience[]> {
    const constructedExperiencesUrl = `${this.experiencesEndpointUrl}?session_id=${this.getSessionId()}`;
    const errorFactory = getServiceErrorFactory(
      "ExperienceService",
      "getExperiences",
      "GET",
      constructedExperiencesUrl
    );

    let response: Response;
    let responseBody: string;
    response = await fetchWithAuth(constructedExperiencesUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.OK,
      serviceName: "ExperienceService",
      serviceFunction: "getExperiences",
      failureMessage: "Failed to retrieve experiences",
      expectedContentType: "application/json",
    });
    responseBody = await response.text();

    let experiencesResponse: Experience[];
    try {
      experiencesResponse = JSON.parse(responseBody);
    } catch (error: unknown) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        {
          responseBody,
          error: error,
        }
      );
    }

    return experiencesResponse;
  }
}
