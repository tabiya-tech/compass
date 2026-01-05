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

// Simple in-memory store; persistence can be layered in later phases.
const getState = (): RegistrationCodeState => ({ ...registrationState });

const setState = (next: RegistrationCodeState): RegistrationCodeState => {
  registrationState = { ...next };
  return getState();
};

export const registrationStore = {
  getState,
  setManualCode: (code: string | null): RegistrationCodeState => {
    if (registrationState.locked) {
      return getState();
    }
    return setState({
      code,
      reportToken: undefined,
      locked: false,
      source: code ? "manual" : null,
    });
  },
  setLinkCode: (code: string, reportToken?: string | null): RegistrationCodeState => {
    return setState({
      code,
      reportToken: reportToken || undefined,
      locked: true,
      source: "link",
    });
  },
  clear: (): RegistrationCodeState => {
    return setState({ code: null, reportToken: undefined, locked: false, source: null });
  },
  isLocked: (): boolean => registrationState.locked,
};

export const REGISTRATION_CODE_PERSISTENCE_KEY = REGISTRATION_CODE_STORAGE_KEY;
