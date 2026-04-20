// Thin wrappers around the two backend endpoints the user journey exercises.
// Request shapes mirror the frontend services so the load test looks identical
// on the wire:
//   - `frontend-new/src/userPreferences/UserPreferencesService/userPreferences.service.ts:96-118`
//   - `frontend-new/src/chat/ChatService/ChatService.ts:28-68`

import http from 'k6/http';
import { check } from 'k6';

function authHeaders(idToken) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  };
}

// RFC4122 v4 UUID. Not cryptographically strong, but fine as a client_id
// (the backend just stores it as an opaque string keyed to the browser/VU).
export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createUserPreferences({
  baseUrl,
  userId,
  idToken,
  invitationCode,
  language,
  clientId,
}) {
  const res = http.post(
    `${baseUrl}/users/preferences`,
    JSON.stringify({
      user_id: userId,
      invitation_code: invitationCode,
      language,
      client_id: clientId,
    }),
    {
      headers: authHeaders(idToken),
      tags: { endpoint: 'preferences' },
    },
  );

  const ok = check(res, {
    'POST /users/preferences status is 201': (r) => r.status === 201,
    'POST /users/preferences returned a session_id': (r) => {
      try {
        const sessions = r.json('sessions');
        return Array.isArray(sessions) && sessions.length > 0;
      } catch (_) {
        return false;
      }
    },
  });

  if (!ok) {
    return { sessionId: null, res };
  }

  const sessions = res.json('sessions');
  return { sessionId: sessions[0], res };
}

export function acceptTermsAndConditions({ baseUrl, userId, idToken, language }) {
  const res = http.patch(
    `${baseUrl}/users/preferences`,
    JSON.stringify({
      user_id: userId,
      language,
      accepted_tc: new Date().toISOString(),
    }),
    {
      headers: authHeaders(idToken),
      tags: { endpoint: 'accept_tc' },
    },
  );

  const ok = check(res, {
    'PATCH /users/preferences status is 200': (r) => r.status === 200,
    'PATCH /users/preferences has accepted_tc': (r) => {
      try {
        return Boolean(r.json('accepted_tc'));
      } catch (_) {
        return false;
      }
    },
  });

  return { ok, res };
}

export function submitPlainPersonalData({ baseUrl, userId, idToken, personalData }) {
  const res = http.post(
    `${baseUrl}/users/${userId}/plain-personal-data`,
    JSON.stringify({ data: personalData }),
    {
      headers: authHeaders(idToken),
      tags: { endpoint: 'personal_data' },
    },
  );

  const ok = check(res, {
    'POST /users/:id/plain-personal-data status is 200': (r) => r.status === 200,
  });

  return { ok, res };
}

export function fetchInitialData({ baseUrl, sessionId, userId, idToken }) {
  const authed = { headers: authHeaders(idToken) };
  // Some endpoints may return 404 for fresh users with no data yet.
  // Tell k6 not to count 404s as HTTP failures, but still catch 429, 5xx, etc.
  const okOrNotFound = { responseCallback: http.expectedStatuses(200, 404) };

  const responses = http.batch([
    ['GET', `${baseUrl}/analytics/sector-engagement/me`,          null, { ...authed, ...okOrNotFound, tags: { endpoint: 'fetch_sector_engagement' } }],
    ['GET', `${baseUrl}/career-readiness/modules`,                null, { ...authed, ...okOrNotFound, tags: { endpoint: 'fetch_career_readiness' } }],
    ['GET', `${baseUrl}/conversations/${sessionId}/messages`,     null, { ...authed, ...okOrNotFound, tags: { endpoint: 'fetch_messages' } }],
    ['GET', `${baseUrl}/users/${userId}/programme-skills`,        null, { ...authed, ...okOrNotFound, tags: { endpoint: 'fetch_programme_skills' } }],
    ['GET', `${baseUrl}/version`,                                 null, { ...okOrNotFound, tags: { endpoint: 'fetch_version' } }],
    ['GET', `${baseUrl}/users/preferences?user_id=${userId}`,     null, { ...authed, ...okOrNotFound, tags: { endpoint: 'fetch_preferences' } }],
    ['GET', `${baseUrl}/users/${userId}/plain-personal-data`,     null, { ...authed, ...okOrNotFound, tags: { endpoint: 'fetch_personal_data' } }],
    ['GET', `${baseUrl}/conversations/${sessionId}/experiences?deleted=false`, null, { ...authed, ...okOrNotFound, tags: { endpoint: 'fetch_experiences' } }],
  ]);

  const isOk = (r) => r.status === 200 || r.status === 404;
  check(responses[0], { 'GET /analytics/sector-engagement/me ok': isOk });
  check(responses[1], { 'GET /career-readiness/modules ok':       isOk });
  check(responses[2], { 'GET /conversations/:id/messages ok':     isOk });
  check(responses[3], { 'GET /users/:id/programme-skills ok':     isOk });
  check(responses[4], { 'GET /version ok':                        isOk });
  check(responses[5], { 'GET /users/preferences ok':              isOk });
  check(responses[6], { 'GET /users/:id/plain-personal-data ok':  isOk });
  check(responses[7], { 'GET /conversations/:id/experiences ok':  isOk });

  return responses;
}

export function sendChatMessage({ baseUrl, sessionId, idToken, userInput }) {
  const res = http.post(
    `${baseUrl}/conversations/${sessionId}/messages`,
    JSON.stringify({ user_input: userInput }),
    {
      headers: authHeaders(idToken),
      tags: { endpoint: 'chat' },
      // Chat responses can take >10s under load while the LLM runs.
      timeout: '120s',
    },
  );

  const ok = check(res, {
    'POST /conversations/:id/messages status is 201': (r) => r.status === 201,
    'chat response has messages array': (r) => {
      try {
        return Array.isArray(r.json('messages'));
      } catch (_) {
        return false;
      }
    },
  });

  let body = null;
  if (ok) {
    try {
      body = res.json();
    } catch (_) {
      body = null;
    }
  }

  return { body, res, ok };
}
