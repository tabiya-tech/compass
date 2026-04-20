import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";
import { scenarios } from "../config.js";
import { logEnvs, requireEnvs, env } from "../lib/env-vars.js";
import { httpStatusCodes } from "../lib/http.js";

const statusCounters = httpStatusCodes;

const firebaseSignupDurationMs = new Trend("firebase_signup_duration_ms", true);
const preferencesCreateDurationMs = new Trend(
  "preferences_create_duration_ms",
  true,
);
const userAiDurationMs = new Trend("user_ai_duration_ms", true);
const sendMessageDurationMs = new Trend("send_message_duration_ms", true);
const endToEndDurationMs = new Trend("e2e_chat_duration_ms", true);

const turnsCounter = new Counter("e2e_chat_turns_total");
const completedCounter = new Counter("e2e_chat_completed_total");
const maxTurnsHitCounter = new Counter("e2e_chat_max_turns_hit_total");
const firebaseSignupCalls = new Counter("firebase_signup_calls_total");
const preferencesCreateCalls = new Counter("preferences_create_calls_total");
const userAiCalls = new Counter("user_ai_calls_total");
const sendMessageCalls = new Counter("send_message_calls_total");
const firebaseSignupFailures = new Counter("firebase_signup_failures_total");
const preferencesCreateFailures = new Counter(
  "preferences_create_failures_total",
);
const userAiFailures = new Counter("user_ai_failures_total");
const sendMessageFailures = new Counter("send_message_failures_total");

const MAX_TURNS_DEFAULT = 12;
const AI_TIMEOUT_DEFAULT = "30s";
const HTTP_TIMEOUT_DEFAULT = "30s";
const CHAT_SLEEP_SECONDS_DEFAULT = 0;

export const options = {
  scenarios: {
    default: scenarios("e2e-skills-elicitation-chat"),
  },
  summaryTrendStats: ["min", "avg", "max", "p(90)", "p(95)"],
  thresholds: {
    send_message_duration_ms: ["avg<10000"],
    preferences_create_duration_ms: ["avg<3000"],
    firebase_signup_duration_ms: ["avg<3000"],
    user_ai_duration_ms: ["avg<5000"],
  },
};

function addStatusCounter(status) {
  if (statusCounters[status]) {
    statusCounters[status].add(1);
  }
}

function createAnonymousFirebaseAccount(firebaseSignupUrl, firebaseApiKey) {
  firebaseSignupCalls.add(1);
  const start = Date.now();
  const res = http.post(
    `${firebaseSignupUrl}?key=${encodeURIComponent(firebaseApiKey)}`,
    JSON.stringify({
      returnSecureToken: true,
    }),
    {
      headers: { "Content-Type": "application/json", Referer: "http://localhost:3000" },
      timeout: HTTP_TIMEOUT_DEFAULT,
    },
  );
  firebaseSignupDurationMs.add(Date.now() - start);
  addStatusCounter(res.status);

  const ok = check(res, {
    "firebase signup status is 200": (r) => r.status === 200,
    "firebase signup has idToken": (r) => {
      const body = safeJson(r.body);
      return !!body?.idToken;
    },
    "firebase signup has localId": (r) => {
      const body = safeJson(r.body);
      return !!body?.localId;
    },
  });

  if (!ok) {
    firebaseSignupFailures.add(1);
    throw new Error(
      `Firebase anonymous signup failed: status=${res.status} body=${res.body}`,
    );
  }

  const body = safeJson(res.body);
  return {
    idToken: body.idToken,
    userId: body.localId,
  };
}

function createUserPreferences(
  baseUrl,
  idToken,
  userId,
  language,
  invitationCode,
  clientId,
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
      const body = safeJson(r.body);
      return Array.isArray(body?.sessions) && body.sessions.length > 0;
    },
    "create preferences has user id": (r) => {
      const body = safeJson(r.body);
      return body?.user_id === undefined || typeof body?.user_id === "string";
    },
  });

  if (!ok) {
    preferencesCreateFailures.add(1);
    throw new Error(
      `Create preferences failed: status=${res.status} body=${res.body}`,
    );
  }

  const body = safeJson(res.body);
  return {
    sessionId: body.sessions[0],
  };
}

function callUserAiService(
  userAiServiceUrl,
  prompt,
  conversationResponse,
  turn,
  sessionId,
  userId,
) {
  userAiCalls.add(1);
  const start = Date.now();
  const res = http.post(
    userAiServiceUrl,
    JSON.stringify({
      prompt,
      turn,
      session_id: sessionId,
      user_id: userId,
      conversation: conversationResponse,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: env("USER_AI_TIMEOUT") || AI_TIMEOUT_DEFAULT,
    },
  );
  userAiDurationMs.add(Date.now() - start);
  addStatusCounter(res.status);

  const ok = check(res, {
    "user ai status is 200": (r) => r.status === 200,
  });

  if (!ok) {
    userAiFailures.add(1);
    throw new Error(
      `User AI service call failed: status=${res.status} body=${res.body}`,
    );
  }

  const body = safeJson(res.body);
  const message =
    body?.message || body?.user_message || body?.next_message || body?.text;
  if (!message || typeof message !== "string") {
    userAiFailures.add(1);
    throw new Error(`User AI response missing message text: body=${res.body}`);
  }
  return message;
}

function sendMessage(baseUrl, idToken, sessionId, userInput) {
  sendMessageCalls.add(1);
  const start = Date.now();
  const res = http.post(
    `${baseUrl}/conversations/${sessionId}/messages`,
    JSON.stringify({
      user_input: userInput,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      timeout: HTTP_TIMEOUT_DEFAULT,
    },
  );
  sendMessageDurationMs.add(Date.now() - start);
  addStatusCounter(res.status);

  const ok = check(res, {
    "send message status is 201": (r) => r.status === 201,
    "send message has completion flag": (r) => {
      const body = safeJson(r.body);
      return typeof body?.conversation_completed === "boolean";
    },
  });

  if (!ok) {
    sendMessageFailures.add(1);
    throw new Error(
      `Send message failed: status=${res.status} body=${res.body}`,
    );
  }

  return safeJson(res.body);
}

function safeJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

export function setup() {
  logEnvs();
  requireEnvs([
    "BASE_URL",
    "FIREBASE_SIGNUP_URL",
    "FIREBASE_API_KEY",
    "LOGIN_CODE",
    "CLIENT_ID",
  ]);
}

export default function () {
  const scenarioStart = Date.now();
  const baseUrl = env("BASE_URL");
  const firebaseSignupUrl = env("FIREBASE_SIGNUP_URL");
  const firebaseApiKey = env("FIREBASE_API_KEY");
  const loginCode = env("LOGIN_CODE");
  const clientId = env("CLIENT_ID");
  const language = env("LANGUAGE") || "en";
  const userAiPrompt =
    env("USER_AI_PROMPT") ||
    "You are simulating a user in a skills elicitation chat.";
  const maxTurns = Number(env("MAX_TURNS") || MAX_TURNS_DEFAULT);
  const sleepSeconds = Number(
    env("CHAT_SLEEP_SECONDS") || CHAT_SLEEP_SECONDS_DEFAULT,
  );

  const { idToken, userId } = createAnonymousFirebaseAccount(
    firebaseSignupUrl,
    firebaseApiKey,
  );
  console.log(`id-token=${idToken}, userId=${userId}`)

  const { sessionId } = createUserPreferences(
    baseUrl,
    idToken,
    userId,
    language,
    loginCode,
    clientId,
  );
  console.log(`sessionId=${sessionId}`)

  let response = sendMessage(baseUrl, idToken, sessionId, "");
  let turn = 0;

  while (!response.conversation_completed && turn < maxTurns) {
    turn += 1;
    turnsCounter.add(1);

    const nextUserMessage = callUserAiService(
      `${baseUrl}/conversations/${sessionId}/messages`,
      userAiPrompt,
      response,
      turn,
      sessionId,
      userId,
    );
    console.log(`turn=${turn}, user_message=${nextUserMessage}`)

    response = sendMessage(baseUrl, idToken, sessionId, nextUserMessage);
    console.log(`turn=${turn}, response=${JSON.stringify(response)}`)

    if (sleepSeconds > 0) {
      sleep(sleepSeconds);
    }
  }

  if (response.conversation_completed) {
    completedCounter.add(1);
  } else {
    maxTurnsHitCounter.add(1);
  }

  endToEndDurationMs.add(Date.now() - scenarioStart);
}
