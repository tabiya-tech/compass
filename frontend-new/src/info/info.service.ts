import infoURL from "./info.constants";

import { VersionItem, Versions } from "./info.types";
import { customFetch } from "src/utils/customFetch/customFetch";

export default class InfoService {
  private static instance: InfoService;
  private cachedInfo: Versions | null = null;

  private constructor() {}

  public static getInstance(): InfoService {
    if (!InfoService.instance) {
      InfoService.instance = new InfoService();
    }
    return InfoService.instance;
  }

  public async loadInfoFromUrl(url: string): Promise<VersionItem> {
    const serviceName = "InfoService";
    const serviceFunction = "loadInfoFromUrl";
    const method = "GET";
    const failureMessage = `Failed to load info from ${url}`;
    try {
      return await customFetch(url, {
        method: method,
        headers: { "content-type": "application/json" },
        expectedStatusCode: 200,
        serviceName: serviceName,
        serviceFunction: serviceFunction,
        failureMessage: failureMessage,
        expectedContentType: "application/json",
        authRequired: false,
        retryOnFailedToFetch: true,
      }).then(async (response) => {
        const data: VersionItem = await response.json();
        if (data === null) {
          throw new Error("No data");
        }
        //jsonschema verify
        return {
          date: data.date || "",
          branch: data.branch || "",
          buildNumber: data.buildNumber || "",
          sha: data.sha || "",
        };
      });
    } catch (error) {
      // Since we don't want the caller to know about the error,
      // we log it and return an empty object.
      console.error(error);
      return { date: "", branch: "", buildNumber: "", sha: "" };
    }
  }

  public async loadInfo() {
    if (this.cachedInfo) {
      return this.cachedInfo;
    }

    // Make API calls concurrently
    const [frontendInfo, backendInfo] = await Promise.all([
      this.loadInfoFromUrl(infoURL.frontend),
      this.loadInfoFromUrl(infoURL.backend),
    ]);

    this.cachedInfo = {
      frontend: frontendInfo,
      backend: backendInfo,
    };

    return this.cachedInfo;
  }

  public clearCache() {
    this.cachedInfo = null;
  }
}
