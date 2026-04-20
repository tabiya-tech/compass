export function logEnvs() {
  Object.entries(__ENV).forEach(([key, value]) =>
    console.log(`env.${key}=${value}`),
  );
}

export const requireEnvs = (envNames) => {
  for (const envName of envNames) {
    if (!__ENV[envName]) {
      console.error(`Missing required env var: ${envName}`);
      throw new Error(`Missing required env var: ${envName}`);
    }

    console.log(`required-env ${envName}=${__ENV[envName]}`);
  }
};

export const env = (name) => __ENV[name];
