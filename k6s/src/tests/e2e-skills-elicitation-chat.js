import http from "k6/http";
import exec from "k6/execution";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

import {
  scenarios,
  HTTP_TIMEOUT_DEFAULT,
  GEMINI_MODEL_DEFAULT,
  MAX_TURNS_DEFAULT,
  CHAT_SLEEP_SECONDS_DEFAULT
} from "../config.js";
import { httpStatusCodes } from "../lib/http.js";
import { logEnvs, requireEnvs, env } from "../lib/env-vars.js";
import { createUserPreferences } from "../lib/compass-api.js";
import { generateNextMessageWithGemini } from "../lib/gemini.js";
import { createAnonymousFirebaseAccount } from "../lib/firebase.js";

const statusCounters = httpStatusCodes;

const firebaseSignupDurationMs = new Trend("firebase_signup_duration_ms", true);
const preferencesCreateDurationMs = new Trend(
  "preferences_create_duration_ms",
  true,
);
const geminiDurationMs = new Trend("gemini_duration_ms", true);
const sendMessageDurationMs = new Trend("send_message_duration_ms", true);
const endToEndDurationMs = new Trend("e2e_chat_duration_ms", true);

const turnsCounter = new Counter("e2e_chat_turns_total");
const completedCounter = new Counter("e2e_chat_completed_total");
const maxTurnsHitCounter = new Counter("e2e_chat_max_turns_hit_total");

const firebaseSignupCalls = new Counter("firebase_signup_calls_total");
const preferencesCreateCalls = new Counter("preferences_create_calls_total");
const geminiCalls = new Counter("gemini_calls_total");
const sendMessageCalls = new Counter("send_message_calls_total");

const firebaseSignupFailures = new Counter("firebase_signup_failures_total");
const preferencesCreateFailures = new Counter(
  "preferences_create_failures_total",
);
const geminiFailures = new Counter("gemini_failures_total");
const sendMessageFailures = new Counter("send_message_failures_total")

export const options = {
  scenarios: {
    default: scenarios("e2e-skills-elicitation-chat"),
  },
  summaryTrendStats: ["min", "avg", "max", "p(90)", "p(95)"],
  thresholds: {
    send_message_duration_ms: ["avg<10000"],
    preferences_create_duration_ms: ["avg<3000"],
    firebase_signup_duration_ms: ["avg<3000"],
    gemini_duration_ms: ["avg<7000"],
  },
};

function addStatusCounter(status) {
  if (statusCounters[status]) {
    statusCounters[status].add(1);
  }
}

function extractLastAiMessage(conversationResponse) {
  const messages = conversationResponse?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return "";
  }

  const lastMessage = messages[messages.length - 1];
  return typeof lastMessage?.message === "string" ? lastMessage.message : "";
}

function formatDurationSeconds(durationMs) {
  const seconds = Math.round((durationMs / 1000) * 100) / 100;
  return `${seconds} sec`;
}

function sendMessage(baseUrl, idToken, sessionId, userInput) {
  sendMessageCalls.add(1);
  const start = Date.now();
  const res = http.post(
    `${baseUrl}/conversations/${sessionId}/messages`,
    JSON.stringify({ user_input: userInput }),
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
    "send message has completion flag": (r) =>
      typeof r.json()?.conversation_completed === "boolean",
  });

  if (!ok) {
    sendMessageFailures.add(1);
    throw new Error(
      `Send message failed: status=${res.status} body=${res.body}`,
    );
  }

  return {
    response: res.json(),
    durationMs: Date.now() - start,
  };
}

export function setup() {
  logEnvs();
  requireEnvs([
    "BASE_URL",
    "FIREBASE_SIGNUP_URL",
    "FIREBASE_API_KEY",
    "CLIENT_ID",
    "GEMINI_API_KEY",
  ]);

  if (!env("INVITATION_CODE") && !env("LOGIN_CODE")) {
    throw new Error(
      "Missing required env var: INVITATION_CODE (or LOGIN_CODE)",
    );
  }
}

export default function () {
  const scenarioStart = Date.now();
  const baseUrl = env("BASE_URL");
  const firebaseSignupUrl = env("FIREBASE_SIGNUP_URL");
  const firebaseApiKey = env("FIREBASE_API_KEY");
  const invitationCode = env("INVITATION_CODE") || env("LOGIN_CODE");
  const clientId = env("CLIENT_ID");
  const language = env("LANGUAGE") || "en";
  const geminiApiKey = env("GEMINI_API_KEY");
  const geminiModel = env("GEMINI_MODEL") || GEMINI_MODEL_DEFAULT;
  const userAiPrompt =
    env("USER_AI_PROMPT") ||
    "You are simulating a realistic user in a Compass skills elicitation conversation.";
  const maxTurns = Number(env("MAX_TURNS") || MAX_TURNS_DEFAULT);
  const sleepSeconds = Number(
    env("CHAT_SLEEP_SECONDS") || CHAT_SLEEP_SECONDS_DEFAULT,
  );

  const { idToken, userId } = createAnonymousFirebaseAccount(
    firebaseSignupUrl,
    firebaseApiKey,
    {
      firebaseSignupCalls,
      firebaseSignupDurationMs,
      addStatusCounter,
      firebaseSignupFailures,
    },
  );
  const { sessionId } = createUserPreferences(
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
  );
  const vu = exec.vu.idInTest;
  const iter = exec.scenario.iterationInTest;
  const runId = `vu${vu}-iter${iter}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

  let { response } = sendMessage(baseUrl, idToken, sessionId, "");
  let turn = 0;
  let turns = []

  while (!response.conversation_completed && turn < maxTurns) {
    turn += 1;
    turnsCounter.add(1);

    const { message: nextUserMessage, durationMs: userMessageDurationMs } =
      generateNextMessageWithGemini(
        geminiApiKey,
        geminiModel,
        userAiPrompt,
        response,
        turn,
        sessionId,
        userId,
        { geminiCalls, geminiDurationMs, addStatusCounter, geminiFailures },
      );

    const { response: turnResponse, durationMs: aiMessageDurationMs } =
      sendMessage(baseUrl, idToken, sessionId, nextUserMessage);

    const turnRecord = {
      user: nextUserMessage,
      ai: extractLastAiMessage(turnResponse),
      user_message_time_taken: formatDurationSeconds(userMessageDurationMs),
      ai_message_time_taken: formatDurationSeconds(aiMessageDurationMs),
      turn_number: turn,
    };
    turns.push(turnRecord);

    response = turnResponse;

    if (sleepSeconds > 0) {
      sleep(sleepSeconds);
    }
  }

  vuTurns[sessionId] = turns;

  if (response.conversation_completed) {
    completedCounter.add(1);
  } else {
    maxTurnsHitCounter.add(1);
  }

  endToEndDurationMs.add(Date.now() - scenarioStart);
}
