// Reads k6 env vars (passed via `-e KEY=value` or shell env), validates that
// required ones are present, and exposes a typed config object + a map of
// ramp profiles for `options.stages`.

const REQUIRED = ['BASE_URL', 'FIREBASE_API_KEY', 'INVITATION_CODE'];

// Each profile is a template of VU multipliers (fraction of peak) and duration
// weights (proportional share of total time). `buildStages()` turns these into
// concrete k6 stage objects using the configured VUSERS / DURATION env vars.
// When those vars are unset, the per-profile defaults reproduce the original
// hardcoded values exactly.
const PROFILE_TEMPLATES = {
  smoke: {
    defaultVUsers: 1,
    defaultDurationSec: 35,
    stages: [
      { vuMultiplier: 1.0, durationWeight: 10 },
      { vuMultiplier: 1.0, durationWeight: 20 },
      { vuMultiplier: 0, durationWeight: 5 },
    ],
  },
  baseline: {
    defaultVUsers: 5,
    defaultDurationSec: 180,
    stages: [
      { vuMultiplier: 1.0, durationWeight: 30 },
      { vuMultiplier: 1.0, durationWeight: 120 },
      { vuMultiplier: 0, durationWeight: 30 },
    ],
  },
  stress: {
    defaultVUsers: 100,
    defaultDurationSec: 360,
    stages: [
      { vuMultiplier: 0.05, durationWeight: 30 },
      { vuMultiplier: 0.2, durationWeight: 60 },
      { vuMultiplier: 0.5, durationWeight: 120 },
      { vuMultiplier: 1.0, durationWeight: 120 },
      { vuMultiplier: 0, durationWeight: 30 },
    ],
  },
  spike: {
    defaultVUsers: 100,
    defaultDurationSec: 130,
    stages: [
      { vuMultiplier: 0.05, durationWeight: 10 },
      { vuMultiplier: 1.0, durationWeight: 10 },
      { vuMultiplier: 1.0, durationWeight: 60 },
      { vuMultiplier: 0.05, durationWeight: 10 },
      { vuMultiplier: 0.05, durationWeight: 30 },
      { vuMultiplier: 0, durationWeight: 10 },
    ],
  },
};

function parseDurationToSeconds(str) {
  let total = 0;
  const minMatch = str.match(/(\d+)m/);
  const secMatch = str.match(/(\d+)s/);
  if (minMatch) total += parseInt(minMatch[1], 10) * 60;
  if (secMatch) total += parseInt(secMatch[1], 10);
  return total;
}

function formatDuration(totalSeconds) {
  const s = Math.max(1, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem}s`;
  if (rem === 0) return `${m}m`;
  return `${m}m${rem}s`;
}

function buildStages(vUsers, totalDurationSec, template) {
  const totalWeight = template.stages.reduce((sum, st) => sum + st.durationWeight, 0);

  return template.stages.map((stage) => {
    const durationSec = (stage.durationWeight / totalWeight) * totalDurationSec;
    const target =
      stage.vuMultiplier === 0 ? 0 : Math.max(1, Math.round(vUsers * stage.vuMultiplier));
    return { duration: formatDuration(durationSec), target };
  });
}

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
  vUsers: __ENV.VUSERS ? Number(__ENV.VUSERS) : null,
  duration: __ENV.DURATION || null,
};

export function getStages() {
  const profile = config.stagesProfile;
  const template = PROFILE_TEMPLATES[profile];
  if (!template) {
    throw new Error(
      `Unknown STAGES_PROFILE='${profile}'. Valid values: ${Object.keys(PROFILE_TEMPLATES).join(', ')}`,
    );
  }

  const vUsers = config.vUsers || template.defaultVUsers;
  if (vUsers <= 0) {
    throw new Error(`VUSERS must be a positive integer, got '${config.vUsers}'.`);
  }

  let totalDurationSec = template.defaultDurationSec;
  if (config.duration) {
    totalDurationSec = parseDurationToSeconds(config.duration);
    if (totalDurationSec <= 0) {
      throw new Error(
        `Invalid DURATION='${config.duration}'. Use k6 format: '30s', '2m', '5m30s'.`,
      );
    }
  }

  const stages = buildStages(vUsers, totalDurationSec, template);

  console.log(
    `[config] profile=${profile} vUsers=${vUsers} duration=${totalDurationSec}s stages=${JSON.stringify(stages)}`,
  );

  return stages;
}
