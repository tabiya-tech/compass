import { getBackendUrl } from "src/envService";
import { getRestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import { customFetch } from "src/utils/customFetch/customFetch";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { Experience, UpdateExperienceRequest } from "src/experiences/experienceService/experiences.types";

export default class ExperienceService {
  readonly experiencesEndpointUrl: string;
  readonly apiServeUrl: string;

  private static instance: ExperienceService;

  /**
   * Get the singleton instance of ExperienceService.
   * @returns {ExperienceService} The singleton instance.
   */
  public static getInstance(): ExperienceService {
    if (!ExperienceService.instance) {
      ExperienceService.instance = new ExperienceService();
    }
    return ExperienceService.instance;
  }

  private constructor() {
    this.apiServeUrl = getBackendUrl();
    this.experiencesEndpointUrl = `${this.apiServeUrl}/conversations`;
  }

  async getExperiences(sessionId: number, original: boolean = false): Promise<Experience[]> {
    const constructedExperiencesUrl = `${this.experiencesEndpointUrl}/${sessionId}/experiences?original=${original}`;
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

  async updateExperience(
    sessionId: number,
    experienceId: string,
    updatedFields: UpdateExperienceRequest
  ): Promise<Experience> {
    const serviceName = "ExperienceService";
    const serviceFunction = "updateExperience";
    const method = "PATCH";
    const experienceURL = `${this.apiServeUrl}/conversations/${sessionId}/experiences/${experienceId}`;
    const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, method, experienceURL);

    const response = await customFetch(experienceURL, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedFields),
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to update experience with UUID ${experienceId}`,
      expectedContentType: "application/json",
    });

    let updatedExperience: Experience;
    try {
      updatedExperience = JSON.parse(await response.text());
    } catch (error: unknown) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        {
          error: error,
        }
      );
    }

    return updatedExperience;
  }

  async getOriginalExperience(
    sessionId: number,
    experienceId: string
  ): Promise<Experience> {
    const serviceName = "ExperienceService";
    const serviceFunction = "getOriginalExperience";
    const method = "GET";
    const experienceURL = `${this.apiServeUrl}/conversations/${sessionId}/experiences/${experienceId}/original`;
    const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, method, experienceURL);

    const response = await customFetch(experienceURL, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to retrieve experience with UUID ${experienceId}`,
      expectedContentType: "application/json",
    });

    let updatedExperience: Experience;
    try {
      updatedExperience = JSON.parse(await response.text());
    } catch (error: unknown) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        {
          error: error,
        }
      );
    }

    return updatedExperience;
  }

  async deleteExperience(sessionId: number, experienceId: string): Promise<void> {
    const serviceName = "ExperienceService";
    const serviceFunction = "deleteExperience";
    const method = "DELETE";
    const experienceURL = `${this.apiServeUrl}/conversations/${sessionId}/experiences/${experienceId}`;

    await customFetch(experienceURL, {
      method: method,
      expectedStatusCode: StatusCodes.NO_CONTENT,
      serviceName: serviceName,
      serviceFunction: serviceFunction,
      failureMessage: `Failed to delete experience with UUID ${experienceId}`,
    });
  }
}
