import { StatusCodes } from "http-status-codes";
import { customFetch } from "src/utils/customFetch/customFetch";
import { getBackendUrl } from "src/envService";
import { getRestAPIErrorFactory, type RestAPIErrorFactory } from "src/error/restAPIError/RestAPIError";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";

const SERVICE_NAME = "InstitutionService";

export interface InstitutionSummary {
  name: string;
  reg_no?: string | null;
  province?: string | null;
  sectors_covered?: string[] | null;
  programmes?: string[] | null;
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

  private constructor() {
    this.baseUrl = `${getBackendUrl()}/institutions`;
  }

  static getInstance(): InstitutionService {
    if (!InstitutionService.instance) {
      InstitutionService.instance = new InstitutionService();
    }
    return InstitutionService.instance;
  }

  async searchInstitutions(
    params: {
      keywords?: string;
      province?: string;
      limit?: number;
      cursor?: string;
      include?: string;
      fields?: string;
    } = {}
  ): Promise<InstitutionsApiResponse> {
    const query = new URLSearchParams();
    if (params.keywords) query.set("keywords", params.keywords);
    if (params.province) query.set("province", params.province);
    if (params.limit) query.set("limit", String(params.limit));
    if (params.cursor) query.set("cursor", params.cursor);
    if (params.include) query.set("include", params.include);
    if (params.fields) query.set("fields", params.fields);

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
}
