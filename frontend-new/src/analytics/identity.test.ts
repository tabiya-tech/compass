import {
  captureRegistrationCodeFromUrl,
  clearUserIdentity,
  getStoredIdentity,
  resolveAndSetUserIdentity,
  setUserIdentityFromAuth,
} from "./identity";
import { pushToDataLayer } from "src/services/analytics/dataLayer";
import { REGISTRATION_CODE_QUERY_PARAM } from "src/config/registrationCode";
import { Language, SensitivePersonalDataRequirement } from "src/userPreferences/UserPreferencesService/userPreferences.types";

jest.mock("src/services/analytics/dataLayer", () => ({
  pushToDataLayer: jest.fn(),
}));

describe("analytics identity helper", () => {
  beforeEach(() => {
    sessionStorage.clear();
    (pushToDataLayer as jest.Mock).mockClear();
  });

  test("sets registration_code identity and persists", () => {
    const identity = setUserIdentityFromAuth({ registrationCode: "RC123", userId: "legacy-id", source: "secure_link" });

    expect(identity?.user_id).toBe("RC123");
    expect(getStoredIdentity()?.registration_code).toBe("RC123");
    expect(pushToDataLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "user_identity_set",
        user_id: "RC123",
        registration_code: "RC123",
        identifier_type: "registration_code",
        source: "secure_link",
      }),
      expect.objectContaining({
        identifier_type: "registration_code",
        user_id_present: true,
        registration_code_present: true,
      })
    );
  });

  test("sets legacy user_id when registration_code is missing", () => {
    setUserIdentityFromAuth({ userId: "user-42", source: "legacy" });

    expect(pushToDataLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "user_identity_set",
        identifier_type: "user_id",
        user_id: "user-42",
        registration_code: null,
      }),
      expect.any(Object)
    );
  });

  test("resolve uses pending registration code when no profile data", () => {
    captureRegistrationCodeFromUrl(`?${REGISTRATION_CODE_QUERY_PARAM}=PENDING_CODE`, "secure_link");
    (pushToDataLayer as jest.Mock).mockClear();

    resolveAndSetUserIdentity({ userId: "user-1", userPreferences: null, registrationState: undefined });

    expect(pushToDataLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "user_identity_set",
        identifier_type: "registration_code",
        user_id: "PENDING_CODE",
        registration_code: "PENDING_CODE",
      }),
      expect.any(Object)
    );
  });

  test("resolve prefers profile registration_code over registration state", () => {
    const registrationState = { code: "LOCKED_CODE", reportToken: undefined, locked: true, source: "link" as const };

    resolveAndSetUserIdentity({
      userId: "user-2",
      userPreferences: {
        user_id: "user-2",
        registration_code: "PROFILE_CODE",
        invitation_code: "inv-1",
        report_token: null,
        language: Language.en,
        sessions: [],
        user_feedback_answered_questions: {},
        sensitive_personal_data_requirement: SensitivePersonalDataRequirement.NOT_REQUIRED,
        has_sensitive_personal_data: false,
        experiments: {},
      },
      registrationState,
    });

    expect(pushToDataLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "PROFILE_CODE",
        registration_code: "PROFILE_CODE",
        identifier_type: "registration_code",
      }),
      expect.any(Object)
    );
  });

  test("clears identity and emits cleared event", () => {
    setUserIdentityFromAuth({ registrationCode: "RC123", userId: "legacy-id" });
    (pushToDataLayer as jest.Mock).mockClear();

    clearUserIdentity();

    expect(getStoredIdentity()).toBeNull();
    expect(pushToDataLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "user_identity_cleared",
        auth_state: "logged_out",
      }),
    );
  });
});
