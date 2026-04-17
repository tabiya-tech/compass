// Firebase anonymous sign-in via the Identity Toolkit REST API.
// Mirrors what firebase-js-sdk does under the hood when the frontend calls
// `firebaseAuth.signInAnonymously()` — see
// `frontend-new/src/auth/services/FirebaseAuthenticationService/invitationCodeAuth/FirebaseInvitationCodeAuthenticationService.ts:63-73`.
//
// The returned `idToken` is a short-lived JWT (~1h) that the backend accepts
// as `Authorization: Bearer <idToken>`. Because each k6 iteration signs in
// fresh, we never need to refresh it.

import http from 'k6/http';
import { check, fail } from 'k6';

const SIGNUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';

export function signInAnonymously(apiKey) {
  const res = http.post(
    `${SIGNUP_URL}?key=${apiKey}`,
    JSON.stringify({ returnSecureToken: true }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'firebase_signup' },
    },
  );

  const ok = check(res, {
    'firebase signUp status is 200': (r) => r.status === 200,
    'firebase signUp returned idToken': (r) => {
      try {
        return Boolean(r.json('idToken'));
      } catch (_) {
        return false;
      }
    },
  });

  if (!ok) {
    fail(`Firebase anonymous sign-in failed: status=${res.status} body=${res.body}`);
  }

  const body = res.json();
  return {
    idToken: body.idToken,
    userId: body.localId,
    refreshToken: body.refreshToken,
  };
}
