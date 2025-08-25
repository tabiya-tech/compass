import { getBackendUrl } from "src/envService";
import { getRestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { customFetch } from "src/utils/customFetch/customFetch";

export default class CVService {
  private static instance: CVService;
  readonly cvEndpointUrl: string;
  readonly apiServerUrl: string;

  private constructor() {
    this.apiServerUrl = getBackendUrl();
    this.cvEndpointUrl = `${this.apiServerUrl}/users`;
  }

  /**
   * Get the singleton instance of the CVService.
   * @returns {CVService} The singleton instance of the CVService.
   */
  static getInstance(): CVService {
    if (!CVService.instance) {
      CVService.instance = new CVService();
    }
    return CVService.instance;
  }

  public async uploadCV(userId: string, file: File): Promise<string> {
    const serviceName = "CVService";
    const serviceFunction = "uploadCV";
    const method = "POST";
    const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, method, this.cvEndpointUrl);
    const constructedUploadUrl = `${this.cvEndpointUrl}/${userId}/cv`;

    // TEMP: mock response until backend endpoint is implemented
    const USE_MOCK = true;
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return `1. Worked as a project manager at the University of Oxford, from 2018 to 2020. It was a paid job and you worked remotely.
2. Worked as a software architect at ProUbis GmbH in berlin, from 2010 to 2018. It was a full-time job.
3. You owned a bar/restaurant called Dinner For Two in Berlin from 2010 until covid-19, then you sold it.
4. Co-founded Acme Inc. in 2022, a gen-ai startup based in DC, USA. You owned this business and your role was CEO.
5. In 1998 did an unpaid internship as a Software Developer for Ubis GmbH in Berlin.
6. Between 2015-2017 volunteer, taught coding to kids in a community center in Berlin.
7. Helped your elderly neighbor with groceries and cleaning every week since 2019.`;
    }

    // Create a FormData object to properly send the file
    const formData = new FormData();
    formData.append('file', file);

    const response = await customFetch(constructedUploadUrl, {
      method: method,
      body: formData,
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to upload CV for user ${userId}`,
      expectedContentType: "application/json",
    });

    const responseText = await response.text();

    let parseResponse: string;
    try {
      parseResponse = JSON.parse(responseText);

    } catch (e: any) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        {
          responseText,
          error: e,
        }
      );
    }

    return parseResponse;
  }
}
