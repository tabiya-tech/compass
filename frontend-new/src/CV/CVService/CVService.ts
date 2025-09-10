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

  public async uploadCV(userId: string, file: File): Promise<string[]> {
    const serviceName = "CVService";
    const serviceFunction = "uploadCV";
    const method = "POST";
    const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, method, this.cvEndpointUrl);
    const constructedUploadUrl = `${this.cvEndpointUrl}/${userId}/cv`;

    const resolveContentType = (): string => {
      if (file.type) return file.type;
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".pdf")) return "application/pdf";
      if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      if (lower.endsWith(".txt")) return "text/plain";
      return "application/octet-stream";
    };

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": resolveContentType(),
      // Backend reads either 'filename' or 'x-filename'. Using custom header triggers preflight, which is OK.
      "x-filename": file.name,
    };

    const response = await customFetch(constructedUploadUrl, {
      method: method,
      body: file, // stream raw file bytes; backend expects raw body, not multipart
      headers,
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to upload CV for user ${userId}`,
      expectedContentType: "application/json",
      compressRequestBody: false, // Disable compression for file uploads
    });

    const responseText = await response.text();

    let parseResponse: { experiences_data?: string[] };
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

    const experiences = Array.isArray(parseResponse.experiences_data) ? parseResponse.experiences_data : [];
    return experiences;
  }
}
