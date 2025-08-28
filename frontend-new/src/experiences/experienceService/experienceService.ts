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

  async getExperiences(sessionId: number, deleted: boolean = false): Promise<Experience[]> {
    const constructedExperiencesUrl = `${this.experiencesEndpointUrl}/${sessionId}/experiences?deleted=${deleted}`;
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
      retryOnFailedToFetch: true
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

  async getUneditedExperience(sessionId: number, experienceId: string): Promise<Experience> {
    const serviceName = "ExperienceService";
    const serviceFunction = "getUneditedExperience";
    const method = "GET";
    const experienceURL = `${this.apiServeUrl}/conversations/${sessionId}/experiences/${experienceId}/unedited`;
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
      retryOnFailedToFetch: true
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

  async restoreDeletedExperience(sessionId: number, experienceId: string): Promise<Experience> {
    const url = `${this.experiencesEndpointUrl}/${sessionId}/experiences/${experienceId}/restore`;
    const errorFactory = getRestAPIErrorFactory("ExperienceService", "restoreDeletedExperience", "POST", url);
    const response = await customFetch(url, {
      method: "POST",
      expectedStatusCode: StatusCodes.OK,
      serviceName: "ExperienceService",
      serviceFunction: "restoreExperience",
      failureMessage: `Failed to restore experience with UUID ${experienceId}`,
    });

    let restoredExperience: Experience;
    try {
      restoredExperience = JSON.parse(await response.text());
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
    return restoredExperience;
  }
}
