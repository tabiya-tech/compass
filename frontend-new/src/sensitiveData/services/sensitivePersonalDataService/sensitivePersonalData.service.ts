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
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

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
    // create the name, and add spaces if both names are provided
    let full_name;

    if (personal_data.firstName && personal_data.lastName) {
      full_name = personal_data.firstName + " " + personal_data.lastName
    } else {
      full_name = personal_data.firstName || personal_data.lastName || ""
    }

    PersistentStorageService.setPersonalInfo({
      fullName: full_name,
      phoneNumber: personal_data.phoneNumber,
      contactEmail: personal_data.contactEmail,
      address: personal_data.address,
    })

    const payload = {
      first_name: personal_data.firstName,
      last_name: personal_data.lastName,
      contact_email: personal_data.contactEmail,
      phone_number:personal_data.phoneNumber,
      address: personal_data.address,
      gender: personal_data.gender
    }

    const encryptSensitivePersonalData = await this.encryptionService.encryptSensitivePersonalData(payload);

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
