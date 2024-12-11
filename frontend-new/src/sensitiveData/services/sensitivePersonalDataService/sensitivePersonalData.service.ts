import { getBackendUrl } from "src/envService";
import { StatusCodes } from "http-status-codes";
import { customFetch } from "src/utils/customFetch/customFetch";
import { browserEncryptionService } from "src/sensitiveData/services/encryptionService/encryption.service";

import { SensitivePersonalData } from "./types";

class SensitivePersonalDataService {
  private readonly sensitivePersonalDataBaseUrl: string;

  constructor() {
    this.sensitivePersonalDataBaseUrl = `${getBackendUrl()}/users/{user_id}/sensitive-personal-data`;
  }

  /**
   * Creates sensitive personal data for a user.
   */
  async createSensitivePersonalData(personal_data: SensitivePersonalData, user_id: string): Promise<void> {
    const encryptSensitivePersonalData = await browserEncryptionService.encryptSensitivePersonalData(personal_data);

    await customFetch(this.sensitivePersonalDataBaseUrl.replace("{user_id}", user_id), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.CREATED,
      serviceName: "SensitivePersonalData",
      serviceFunction: "createSensitivePersonalData",
      failureMessage: `Failed to create sensitive personal data for user with id ${user_id}`,
      body: JSON.stringify(encryptSensitivePersonalData),
      expectedContentType: "application/json",
    });
  }
}

export const sensitivePersonalDataService = new SensitivePersonalDataService();
