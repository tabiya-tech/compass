import http from "k6/http";
import { check } from "k6";
import { FIREBASE_IMITATED_CLIENT, HTTP_TIMEOUT_DEFAULT } from "../config.js";

export function createAnonymousFirebaseAccount(
  firebaseSignupUrl,
  firebaseApiKey,
  {
    firebaseSignupCalls,
    firebaseSignupDurationMs,
    addStatusCounter,
    firebaseSignupFailures,
  },
) {
  firebaseSignupCalls.add(1);
  const start = Date.now();
  const res = http.post(
    `${firebaseSignupUrl}?key=${encodeURIComponent(firebaseApiKey)}`,
    JSON.stringify({ returnSecureToken: true }),
    {
      headers: {
        "Content-Type": "application/json",
        Referer: FIREBASE_IMITATED_CLIENT,
      },
      timeout: HTTP_TIMEOUT_DEFAULT,
    },
  );
  firebaseSignupDurationMs.add(Date.now() - start);
  addStatusCounter(res.status);

  const ok = check(res, {
    "firebase signup status is 200": (r) => r.status === 200,
    "firebase signup has idToken": (r) => !!JSON.parse(r.body)?.idToken,
    "firebase signup has localId": (r) => !!JSON.parse(r.body)?.localId,
  });

  if (!ok) {
    firebaseSignupFailures.add(1);
    throw new Error(
      `Firebase anonymous signup failed: status=${res.status} body=${res.body}`,
    );
  }

  const body = JSON.parse(res.body);
  return { idToken: body.idToken, userId: body.localId };
}
