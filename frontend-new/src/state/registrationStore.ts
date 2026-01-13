import { REGISTRATION_CODE_STORAGE_KEY } from "src/config/registrationCode";

export type RegistrationCodeSource = "link" | "manual" | "unknown" | null;

export type RegistrationCodeState = {
  code: string | null;
  reportToken?: string;
  locked: boolean;
  source: RegistrationCodeSource;
};

let registrationState: RegistrationCodeState = {
  code: null,
  reportToken: undefined,
  locked: false,
  source: null,
};

type PersistedRegistrationState = {
  code: string;
  reportToken?: string | null;
};

const getState = (): RegistrationCodeState => ({ ...registrationState });

const persistState = (state: RegistrationCodeState): void => {
  try {
    if (!state.code) {
      window.localStorage.removeItem(REGISTRATION_CODE_STORAGE_KEY);
      return;
    }
    const payload: PersistedRegistrationState = {
      code: state.code,
      reportToken: state.reportToken ?? null,
    };
    window.localStorage.setItem(REGISTRATION_CODE_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // Swallow storage errors (e.g., private mode / disabled storage)
    console.info("Skipping registration code persistence", err);
  }
};

const loadPersistedState = (): PersistedRegistrationState | null => {
  try {
    const raw = window.localStorage.getItem(REGISTRATION_CODE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedRegistrationState;
    if (!parsed.code) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.info("Skipping registration code load", err);
    return null;
  }
};

const setState = (next: RegistrationCodeState, persist = false): RegistrationCodeState => {
  registrationState = { ...next };
  if (persist) {
    persistState(registrationState);
  }
  return getState();
};

export const registrationStore = {
  getState,
  setManualCode: (code: string | null): RegistrationCodeState => {
    if (registrationState.locked) {
      return getState();
    }
    return setState(
      {
        code,
        reportToken: undefined,
        locked: false,
        source: code ? "manual" : null,
      },
      false
    );
  },
  setLinkCode: (code: string, reportToken?: string | null): RegistrationCodeState => {
    return setState(
      {
        code,
        reportToken: reportToken || undefined,
        locked: true,
        source: "link",
      },
      true
    );
  },
  clear: (): RegistrationCodeState => {
    persistState({ code: null, reportToken: undefined, locked: false, source: null });
    return setState({ code: null, reportToken: undefined, locked: false, source: null });
  },
  isLocked: (): boolean => registrationState.locked,
  hydrateFromStorage: (): RegistrationCodeState => {
    const stored = typeof window !== "undefined" ? loadPersistedState() : null;
    if (!stored) {
      return getState();
    }
    return setState(
      {
        code: stored.code,
        reportToken: stored.reportToken ?? undefined,
        locked: true,
        source: "link",
      },
      false
    );
  },
};

export const REGISTRATION_CODE_PERSISTENCE_KEY = REGISTRATION_CODE_STORAGE_KEY;
