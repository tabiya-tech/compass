import { AuthProviderIds } from "src/auth/auth.types";

const auth = jest.fn(() => ({
  signInWithCustomToken: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  GoogleAuthProvider: { PROVIDER_ID: AuthProviderIds.GOOGLE },
}));

export function mockFirebaseConfig() {
  jest.spyOn(require("src/auth/firebaseConfig"), "auth").mockImplementation(auth);
}
