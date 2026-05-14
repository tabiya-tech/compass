import { getRestAPIErrorFactory, type RestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import { StatusCodes } from "http-status-codes";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { customFetch } from "src/utils/customFetch/customFetch";
import { getBackendUrl } from "src/envService";

const SERVICE_NAME = "InstitutionService";

export interface InstitutionSummary {
  name: string;
  reg_no?: string | null;
  province?: string | null;
  sectors_covered?: string[] | null;
}

export interface Programme {
  name: string;
  qualification_type?: string | null;
  zqf_level?: string | null;
  sectors?: string[] | null;
}

export interface InstitutionProgrammes {
  name: string;
  reg_no?: string | null;
  programmes?: Programme[] | null;
}

export interface InstitutionsApiResponse {
  data: InstitutionSummary[];
  meta: {
    limit: number;
    has_more: boolean;
    next_cursor?: string | null;
    total?: number | null;
  };
}

export interface InstitutionAssignment {
  institution_name: string;
  reg_no?: string | null;
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

export default class InstitutionService {
  private static instance: InstitutionService;
  private readonly baseUrl: string;
  private readonly usersBaseUrl: string;

  private constructor() {
    this.baseUrl = `${getBackendUrl()}/institutions`;
    this.usersBaseUrl = `${getBackendUrl()}/users`;
  }

  static getInstance(): InstitutionService {
    if (!InstitutionService.instance) {
      InstitutionService.instance = new InstitutionService();
    }
    return InstitutionService.instance;
  }

  async searchInstitutions(keywords: string, limit: number = 10): Promise<InstitutionsApiResponse> {
    const query = new URLSearchParams({ keywords, limit: String(limit) });
    const url = `${this.baseUrl}?${query.toString()}`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "searchInstitutions", "GET", url);

    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "searchInstitutions",
      failureMessage: "Failed to search institutions",
      expectedContentType: "application/json",
    });
    const body = await response.text();
    return parseJson<InstitutionsApiResponse>(body, errorFactory);
  }

  async getInstitutionAssignment(): Promise<InstitutionAssignment | null> {
    const url = `${this.usersBaseUrl}/me/institution-assignment`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getInstitutionAssignment", "GET", url);

    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getInstitutionAssignment",
      failureMessage: "Failed to fetch institution assignment",
      expectedContentType: "application/json",
      retryOnFailedToFetch: true,
    });
    const body = await response.text();
    return parseJson<InstitutionAssignment | null>(body, errorFactory);
  }

  async getProgrammesByInstitution(regNo: string): Promise<InstitutionProgrammes> {
    const url = `${this.baseUrl}/programmes?${new URLSearchParams({ reg_no: regNo }).toString()}`;
    const errorFactory = getRestAPIErrorFactory(SERVICE_NAME, "getProgrammesByInstitution", "GET", url);

    const response = await customFetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      expectedStatusCode: StatusCodes.OK,
      serviceName: SERVICE_NAME,
      serviceFunction: "getProgrammesByInstitution",
      failureMessage: "Failed to fetch programmes for institution",
      expectedContentType: "application/json",
    });
    const body = await response.text();
    return parseJson<InstitutionProgrammes>(body, errorFactory);
  }
}
