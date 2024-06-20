import { AuthProviderIds } from "src/auth/auth.types";

const auth = {
  currentUser: {
    getIdToken: jest.fn(),
    getIdTokenResult: jest.fn(),
  },
  onAuthStateChanged: jest.fn().mockReturnValue(jest.fn()),
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: { PROVIDER_ID: AuthProviderIds.GOOGLE },
};

const firebase = {
  initializeApp: jest.fn(),
  auth: () => auth,
};

export default firebase;
