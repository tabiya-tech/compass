import { REGISTRATION_CODE_QUERY_PARAM } from "src/config/registrationCode";
import { pushToDataLayer } from "src/services/analytics/dataLayer";
import { GTMUserIdentityClearedEvent, GTMUserIdentitySetEvent } from "src/types/gtm";
import { registrationStore, type RegistrationCodeState } from "src/state/registrationStore";
import type { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";

const IDENTITY_STORAGE_KEY = "analytics_user_identity";
const PENDING_REG_CODE_KEY = "analytics_pending_registration_code";

type IdentifierType = "registration_code" | "user_id";

export type StoredIdentity = {
  user_id: string;
  identifier_type: IdentifierType;
  registration_code?: string | null;
  source?: "secure_link" | "legacy" | "unknown";
  set_at: number;
};

type PendingRegistration = {
  registration_code: string;
  source?: string;
  stored_at: number;
};

type IdentityInput = {
  registrationCode?: string | null;
  userId?: string | null;
  source?: "secure_link" | "legacy" | "unknown";
};

type IdentityResolutionInput = {
  userId?: string | null;
  userPreferences?: UserPreference | null;
  registrationState?: RegistrationCodeState;
};

const safeSessionStorage = (): Storage | null => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }
  return window.sessionStorage;
};

const sanitizeCode = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const savePendingRegistrationCode = (registrationCode: string, source: string): void => {
  const storage = safeSessionStorage();
  if (!storage) return;
  const payload: PendingRegistration = {
    registration_code: registrationCode,
    source,
    stored_at: Date.now(),
  };
  try {
    storage.setItem(PENDING_REG_CODE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.info("Skipping pending registration code persistence", error);
  }
};

const getPendingRegistrationCode = (): string | null => {
  const storage = safeSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(PENDING_REG_CODE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingRegistration;
    return sanitizeCode(parsed.registration_code);
  } catch (error) {
    console.info("Skipping pending registration code retrieval", error);
    return null;
  }
};

const persistIdentity = (identity: StoredIdentity): void => {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch (error) {
    console.info("Skipping identity persistence", error);
  }
};

export const getStoredIdentity = (): StoredIdentity | null => {
  const storage = safeSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredIdentity;
  } catch (error) {
    console.info("Skipping identity load", error);
    return null;
  }
};

const selectRegistrationCode = (
  profile: UserPreference | null | undefined,
  registrationState: RegistrationCodeState | undefined,
  pendingCode: string | null
): string | null => {
  const profileCode = sanitizeCode(profile?.registration_code ?? null);
  if (profileCode) return profileCode;

  const lockedCode = registrationState?.locked ? sanitizeCode(registrationState.code) : null;
  if (lockedCode) return lockedCode;

  return sanitizeCode(pendingCode);
};

const pushIdentitySet = (event: GTMUserIdentitySetEvent): void => {
  pushToDataLayer(event, {
    identifier_type: event.identifier_type,
    user_id_present: Boolean(event.user_id),
    registration_code_present: Boolean(event.registration_code),
  });
};

const warnIfInvalidIdentity = (userId: string | null, identifierType: IdentifierType, registrationCode: string | null): void => {
  if (!userId) {
    console.warn("user identity not set: missing user_id", { identifierType, registrationCodePresent: Boolean(registrationCode) });
    return;
  }
  if (identifierType === "registration_code" && registrationCode && userId !== registrationCode) {
    console.warn("user identity mismatch: user_id differs from registration_code", { userId, registrationCode });
  }
};

export const setUserIdentityFromAuth = ({ registrationCode, userId, source }: IdentityInput): StoredIdentity | null => {
  const sanitizedRegistrationCode = sanitizeCode(registrationCode);
  const sanitizedUserId = sanitizeCode(userId);
  const identifier_type: IdentifierType = sanitizedRegistrationCode ? "registration_code" : "user_id";
  const user_id = sanitizedRegistrationCode ?? sanitizedUserId;

  warnIfInvalidIdentity(user_id ?? null, identifier_type, sanitizedRegistrationCode);
  if (!user_id) {
    return null;
  }

  const identity: StoredIdentity = {
    user_id,
    identifier_type,
    registration_code: sanitizedRegistrationCode,
    source: source ?? (sanitizedRegistrationCode ? "secure_link" : "legacy"),
    set_at: Date.now(),
  };

  const event: GTMUserIdentitySetEvent = {
    event: "user_identity_set",
    user_id,
    identifier_type,
    registration_code: sanitizedRegistrationCode,
    auth_state: "logged_in",
    source: identity.source,
  };
  pushIdentitySet(event);
  persistIdentity(identity);
  return identity;
};

export const clearUserIdentity = (): void => {
  const storage = safeSessionStorage();
  if (storage) {
    storage.removeItem(IDENTITY_STORAGE_KEY);
  }
  const event: GTMUserIdentityClearedEvent = {
    event: "user_identity_cleared",
    auth_state: "logged_out",
  };
  pushToDataLayer(event);
};

export const captureRegistrationCodeFromUrl = (search: string, source: "secure_link" | "manual" | "unknown" = "secure_link"): string | null => {
  const params = new URLSearchParams(search);
  const code = sanitizeCode(params.get(REGISTRATION_CODE_QUERY_PARAM));
  if (code) {
    savePendingRegistrationCode(code, source);
  }
  return code;
};

export const resolveAndSetUserIdentity = ({
  userId,
  userPreferences,
  registrationState,
}: IdentityResolutionInput): StoredIdentity | null => {
  const pending = getPendingRegistrationCode();
  const registrationCode = selectRegistrationCode(userPreferences, registrationState, pending);
  const source: "secure_link" | "legacy" | "unknown" = registrationCode ? "secure_link" : "legacy";
  return setUserIdentityFromAuth({ registrationCode, userId, source });
};

export const getRegistrationState = (): RegistrationCodeState | undefined => {
  try {
    return registrationStore.getState();
  } catch (error) {
    console.info("Skipping registration state load", error);
    return undefined;
  }
};
