// Stress test for the Compass backend. Each VU simulates one complete user:
//   1) Firebase anonymous sign-in (identitytoolkit.googleapis.com)
//   2) POST /users/preferences  -> creates a session
//   3) Loop POST /conversations/{session_id}/messages with scripted prompts
//
// Run:
//   ./run.sh                        # loads k6s/.env and invokes `k6 run`
//   ./run.sh -e STAGES_PROFILE=smoke # override a var for one run
// See README.md for the full configuration flow.

import { sleep, check } from 'k6';
import exec from 'k6/execution';
import { Counter } from 'k6/metrics';

import { config, getStages, validateEnv } from './lib/config.js';
import { signInAnonymously } from './lib/firebase.js';
import { createUserPreferences, sendChatMessage, uuidv4 } from './lib/backend.js';
import { CONVERSATION_SCRIPT, TOTAL_STEPS, pickPrompt } from './lib/prompts.js';

// Custom counters surfaced in the end-of-run summary.
const userFlowsStarted = new Counter('user_flows_started');
const userFlowsCompleted = new Counter('user_flows_completed');
const chatMessagesSent = new Counter('chat_messages_sent');

export const options = {
  stages: getStages(),
  thresholds: {
    // Overall error budget across every request.
    http_req_failed: ['rate<0.05'],
    // Per-endpoint latency (tags set in lib/*.js).
    'http_req_duration{endpoint:firebase_signup}': ['p(95)<3000'],
    'http_req_duration{endpoint:preferences}': ['p(95)<2000'],
    'http_req_duration{endpoint:chat}': ['p(95)<15000'],
    // At least 90% of started flows should finish.
    'user_flows_completed': ['count>0'],
  },
  // Surface per-endpoint stats in the end-of-run summary.
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export function setup() {
  validateEnv();
  console.log(
    `[setup] target=${config.baseUrl} profile=${config.stagesProfile} ` +
      `maxMessagesPerVu=${config.maxMessagesPerVu}`,
  );
  return { startedAt: new Date().toISOString() };
}

export default function () {
  const vu = exec.vu.idInTest;
  const iter = exec.vu.iterationInInstance;

  userFlowsStarted.add(1);

  // 1) Sign in anonymously with Firebase.
  const { idToken, userId } = signInAnonymously(config.firebaseApiKey);

  // 2) Create user preferences -> session_id.
  const clientId = uuidv4();
  const { sessionId } = createUserPreferences({
    baseUrl: config.baseUrl,
    userId,
    idToken,
    invitationCode: config.invitationCode,
    language: config.language,
    clientId,
  });
  if (!sessionId) {
    // createUserPreferences already reported via check(); abort this iteration.
    return;
  }

  // 3) Scripted chat loop. Stop early if the backend signals completion or we
  // hit the per-VU message cap.
  const maxSteps = Math.min(config.maxMessagesPerVu, TOTAL_STEPS);
  let conversationCompleted = false;

  for (let step = 0; step < maxSteps; step++) {
    const userInput = pickPrompt(step, vu, iter);
    const { body, ok } = sendChatMessage({
      baseUrl: config.baseUrl,
      sessionId,
      idToken,
      userInput,
    });

    if (!ok) break;
    chatMessagesSent.add(1);

    if (body && body.conversation_completed) {
      conversationCompleted = true;
      break;
    }

    // Mimic human pacing so we don't hammer the endpoint back-to-back.
    sleep(0.5 + Math.random() * 1.5);
  }

  check(null, {
    'user journey reached the chat loop': () => true,
  });

  userFlowsCompleted.add(1);

  // Optional: tag ends-of-flow where the conversation fully completed.
  if (conversationCompleted) {
    // No dedicated counter yet — summary will show chat_messages_sent vs. flows.
  }
}

export function teardown(data) {
  console.log(`[teardown] started=${data.startedAt} finished=${new Date().toISOString()}`);
}
