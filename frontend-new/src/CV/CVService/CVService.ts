import { getBackendUrl } from "src/envService";
import { getRestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { customFetch } from "src/utils/customFetch/customFetch";
import { UploadProcessState } from "src/chat/Chat.types";
import { CVListItem } from "src/CV/CVService/CVService.types";

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

  public async uploadCV(userId: string, file: File): Promise<{ uploadId: string }> {
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

    let parseResponse: any;
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

    const uploadId: string | undefined = typeof parseResponse === "string" ? parseResponse : parseResponse?.upload_id;
    if (!uploadId) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain required field 'upload_id'",
        { responseText }
      );
    }
    return { uploadId };
  }

  public async cancelUpload(userId: string, uploadId: string): Promise<void> {
    const serviceName = "CVService";
    const serviceFunction = "cancelUpload";
    const method = "POST";
    const constructedCancelUrl = `${this.cvEndpointUrl}/${userId}/cv/${uploadId}/cancel`;

    await customFetch(constructedCancelUrl, {
      method: method,
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to cancel upload ${uploadId} for user ${userId}`,
      expectedContentType: "application/json",
    });
  }

  public async getUploadStatus(
    userId: string,
    uploadId: string
  ): Promise<{
    upload_id: string;
    user_id: string;
    filename: string;
    upload_process_state: UploadProcessState;
    cancel_requested: boolean;
    created_at: string;
    last_activity_at: string;
    error_code?: string;
    error_detail?: string;
    experience_bullets?: string[];
    state_injected?: boolean;
    injection_error?: string | null;
  }> {
    const serviceName = "CVService";
    const serviceFunction = "getUploadStatus";
    const method = "GET";
    const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, method, this.cvEndpointUrl);
    const constructedStatusUrl = `${this.cvEndpointUrl}/${userId}/cv/${uploadId}`;

    const response = await customFetch(constructedStatusUrl, {
      method: method,
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to get status for upload ${uploadId} for user ${userId}`,
      expectedContentType: "application/json",
      retryOnFailedToFetch: true,
    });

    const responseText = await response.text();
    let statusResponse: any;
    try {
      statusResponse = JSON.parse(responseText);
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

    return statusResponse;
  }

  public async getAllCVs(userId: string): Promise<CVListItem[]> {
    const serviceName = "CVService";
    const serviceFunction = "getAllCVs";
    const method = "GET";
    const constructedUrl = `${this.cvEndpointUrl}/${userId}/cv`;
    const errorFactory = getRestAPIErrorFactory(serviceName, serviceFunction, method, constructedUrl);

    const response = await customFetch(constructedUrl, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to fetch CVs for user ${userId}`,
      expectedContentType: "application/json",
      retryOnFailedToFetch: true,
    });

    try {
      return await response.json();
    } catch (error) {
      throw errorFactory(
        response.status,
        ErrorConstants.ErrorCodes.INVALID_RESPONSE_BODY,
        "Response did not contain valid JSON",
        { error }
      );
    }
  }

  public async reinjectFromUpload(userId: string, uploadId: string): Promise<{ success: boolean }>{
    const serviceName = "CVService";
    const serviceFunction = "reinjectFromUpload";
    const method = "POST";
    const constructedUrl = `${this.cvEndpointUrl}/${userId}/cv/${uploadId}/inject`;

    const response = await customFetch(constructedUrl, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      expectedStatusCode: StatusCodes.OK,
      serviceName,
      serviceFunction,
      failureMessage: `Failed to reinject CV ${uploadId} for user ${userId}`,
      expectedContentType: "application/json",
      retryOnFailedToFetch: true,
    });

    const payload = (await response.json().catch(() => ({}))) as { state_injected?: boolean; error?: string };
    return { success: Boolean(payload.state_injected) };
  }
}
