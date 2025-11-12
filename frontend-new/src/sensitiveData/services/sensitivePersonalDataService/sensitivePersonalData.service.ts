import { getBackendUrl } from "src/envService";
import { StatusCodes } from "http-status-codes";
import { customFetch } from "src/utils/customFetch/customFetch";

import { SensitivePersonalData } from "src/sensitiveData/types";
import { EncryptionService } from "src/sensitiveData/services/encryptionService/encryption.service";
import {
  MaximumAESEncryptedDataSize,
  MaximumAESEncryptedKeySize,
  MaximumRSAKeyIdSize,
} from "src/sensitiveData/services/encryptionConfig";
import { EncryptedDataTooLarge } from "./errors";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import { FieldDefinition } from "src/sensitiveData/components/sensitiveDataForm/config/types";
import { toEncryptionPayload } from "../../components/sensitiveDataForm/config/utils";

export class SensitivePersonalDataSkipError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = "SensitivePersonalDataSkipError";
  }
}

class SensitivePersonalDataService {
  private readonly sensitivePersonalDataBaseUrl: string;
  private readonly encryptionService = new EncryptionService();

  constructor() {
    this.sensitivePersonalDataBaseUrl = `${getBackendUrl()}/users/{user_id}/sensitive-personal-data`;
  }

  /**
   * Creates sensitive personal data for a user.
   *
   * @param personal_data - The sensitive personal data to save
   * @param user_id - The ID of the user
   * @param fields - The field definitions
   */
  async createSensitivePersonalData(
    personal_data: SensitivePersonalData,
    user_id: string,
    fields: FieldDefinition[],
  ): Promise<void> {
    // Create full name from first and last name if available
    let fullName = "";
    if (personal_data["firstName"] && personal_data["lastName"]) {
      fullName = `${personal_data["firstName"]} ${personal_data["lastName"]}`;
    } else {
      fullName = (personal_data["firstName"] || personal_data["lastName"] || "") as string;
    }

    // Store personal info for local use
    PersistentStorageService.setPersonalInfo({
      fullName,
      phoneNumber: personal_data["phoneNumber"] as string,
      contactEmail: personal_data["contactEmail"] as string,
    });

    // Convert frontend model to backend request model
    const payload = toEncryptionPayload(personal_data, fields);

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

    const response = await customFetch(this.sensitivePersonalDataBaseUrl.replace("{user_id}", user_id), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // 409 is returned if the user has already provided sensitive data
      // This may happen if the user has already provided sensitive data but
      // the frontend failed to process the response and the user tries to provide it again
      expectedStatusCode: [StatusCodes.CREATED, StatusCodes.CONFLICT],
      serviceName: "SensitivePersonalData",
      serviceFunction: "createSensitivePersonalData",
      failureMessage: `Failed to create sensitive personal data for user with id ${user_id}`,
      body: JSON.stringify({
        sensitive_personal_data: encryptSensitivePersonalData,
      }),
      expectedContentType: "application/json",
    });
    if (response.status === StatusCodes.CONFLICT) {
      console.warn(`User with id ${user_id} has already provided sensitive personal data`);
    }
  }

  /**
   * Skip providing sensitive personal data for a user.
   *
   * @param user_id - The ID of the user skipping sensitive data provision
   * @throws {SensitivePersonalDataSkipError} If there's an error during the skip operation
   * @throws {RestAPIError} If the server returns an error response
   */
  async skip(user_id: string): Promise<void> {
    const response = await customFetch(this.sensitivePersonalDataBaseUrl.replace("{user_id}", user_id), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // 409 is returned if the user has already skipped
      // This may happen if the user has already skipped but
      // the frontend failed to process the response and the user tries to provide it again
      expectedStatusCode: [StatusCodes.CREATED, StatusCodes.CONFLICT],
      serviceName: "SensitivePersonalData",
      serviceFunction: "common.buttons.skip",
      failureMessage: `Failed to skip sensitive personal data for user with id ${user_id}`,
      body: JSON.stringify({}),
      expectedContentType: "application/json",
    });
    if (response.status === StatusCodes.CONFLICT) {
      console.warn(`User with id ${user_id} has already skipped sensitive personal data`);
    }
  }
}

export const sensitivePersonalDataService = new SensitivePersonalDataService();
