// Reads k6 env vars (passed via `-e KEY=value` or shell env), validates that
// required ones are present, and exposes a typed config object + a map of
// ramp profiles for `options.stages`.

const REQUIRED = ['BASE_URL', 'FIREBASE_API_KEY', 'INVITATION_CODE'];

const STAGE_PROFILES = {
  smoke: [
    { duration: '10s', target: 1 },
    { duration: '20s', target: 1 },
    { duration: '5s', target: 0 },
  ],
  baseline: [
    { duration: '30s', target: 5 },
    { duration: '2m', target: 5 },
    { duration: '30s', target: 0 },
  ],
  stress: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 20 },
    { duration: '2m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  spike: [
    { duration: '10s', target: 5 },
    { duration: '10s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '10s', target: 5 },
    { duration: '30s', target: 5 },
    { duration: '10s', target: 0 },
  ],
};

export function validateEnv() {
  const missing = REQUIRED.filter((k) => !__ENV[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required env var(s): ${missing.join(', ')}. ` +
        `Pass them via \`-e KEY=value\` on the k6 CLI or export them in your shell. ` +
        `See k6s/.env.example for the full list.`,
    );
  }
}

function trimTrailingSlash(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export const config = {
  baseUrl: trimTrailingSlash(__ENV.BASE_URL || ''),
  firebaseApiKey: __ENV.FIREBASE_API_KEY || '',
  invitationCode: __ENV.INVITATION_CODE || '',
  language: __ENV.LANGUAGE || 'en',
  stagesProfile: __ENV.STAGES_PROFILE || 'stress',
  maxMessagesPerVu: Number(__ENV.MAX_MESSAGES_PER_VU || 6),
};

export function getStages() {
  const profile = config.stagesProfile;
  const stages = STAGE_PROFILES[profile];
  if (!stages) {
    throw new Error(
      `Unknown STAGES_PROFILE='${profile}'. Valid values: ${Object.keys(STAGE_PROFILES).join(', ')}`,
    );
  }
  return stages;
}
