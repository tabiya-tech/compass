import { getBackendUrl } from "src/envService";
import { getRestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import { customFetch } from "src/utils/customFetch/customFetch";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { Experience } from "src/experiences/experienceService/experiences.types";

export default class ExperienceService {
  readonly experiencesEndpointUrl: string;
  readonly apiServeUrl: string;

  constructor() {
    this.apiServeUrl = getBackendUrl();
    this.experiencesEndpointUrl = `${this.apiServeUrl}/conversations`;
  }

  async getExperiences(sessionId: number): Promise<Experience[]> {
    const constructedExperiencesUrl = `${this.experiencesEndpointUrl}/${sessionId}/experiences`;
    const errorFactory = getRestAPIErrorFactory(
      "ExperienceService",
      "getExperiences",
      "GET",
      constructedExperiencesUrl
    );

    let response: Response;
    let responseBody: string;
    response = await customFetch(constructedExperiencesUrl, {
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
