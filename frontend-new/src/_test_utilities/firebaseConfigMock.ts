const auth = jest.fn(() => ({
  signInWithCustomToken: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  GoogleAuthProvider: { PROVIDER_ID: "google.com" },
}));

export function mockFirebaseConfig() {
  jest.spyOn(require("src/auth/firebaseConfig"), "firebaseAuth").mockImplementation(auth);
}
