import http from "k6/http";
import { check } from "k6";
import { HTTP_TIMEOUT_DEFAULT } from "../config.js";

export function createUserPreferences(
  baseUrl,
  idToken,
  userId,
  language,
  invitationCode,
  clientId,
  {
    preferencesCreateCalls,
    preferencesCreateDurationMs,
    addStatusCounter,
    preferencesCreateFailures,
  },
) {
  preferencesCreateCalls.add(1);
  const start = Date.now();
  const payload = {
    user_id: userId,
    language,
    client_id: clientId,
  };
  if (invitationCode) {
    payload.invitation_code = invitationCode;
  }

  const res = http.post(
    `${baseUrl}/users/preferences`,
    JSON.stringify(payload),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      timeout: HTTP_TIMEOUT_DEFAULT,
    },
  );
  preferencesCreateDurationMs.add(Date.now() - start);
  addStatusCounter(res.status);

  const ok = check(res, {
    "create preferences status is 201": (r) => r.status === 201,
    "create preferences has session": (r) => {
      return Array.isArray(r.json()?.sessions);
    },
  });

  if (!ok) {
    preferencesCreateFailures.add(1);
    throw new Error(
      `Create preferences failed: status=${res.status} body=${res.body}`,
    );
  }

  const body = res.json();
  console.log("create-user-preferences, body=", body);
  return { sessionId: body.sessions[0] };
}
