import { getBackendUrl } from "src/envService";
import { StatusCodes } from "http-status-codes";
import { customFetch } from "src/utils/customFetch/customFetch";

import { SensitivePersonalData } from "src/sensitiveData/types";
import { EncryptionService } from "src/sensitiveData/services/encryptionService/encryption.service";
import {
  MaximumAESEncryptedDataSize,
  MaximumAESEncryptedKeySize,
  MaximumRSAKeyIdSize,
} from "src/sensitiveData/config/encryptionConfig";
import { EncryptedDataTooLarge } from "./errors";

class SensitivePersonalDataService {
  private readonly sensitivePersonalDataBaseUrl: string;
  private readonly encryptionService = new EncryptionService();

  constructor() {
    this.sensitivePersonalDataBaseUrl = `${getBackendUrl()}/users/{user_id}/sensitive-personal-data`;
  }

  /**
   * Creates sensitive personal data for a user.
   */
  async createSensitivePersonalData(personal_data: SensitivePersonalData, user_id: string): Promise<void> {
    const encryptSensitivePersonalData = await this.encryptionService.encryptSensitivePersonalData(personal_data);

    // if for some reason the data to encrypt is too large, we should not proceed.
    // the backend will reject the request if the data is too large.

    if (
      encryptSensitivePersonalData.aes_encrypted_data.length > MaximumAESEncryptedDataSize ||
      encryptSensitivePersonalData.aes_encryption_key.length > MaximumAESEncryptedKeySize ||
      encryptSensitivePersonalData.rsa_key_id.length > MaximumRSAKeyIdSize
    ) {
      throw new EncryptedDataTooLarge(encryptSensitivePersonalData);
    }

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
