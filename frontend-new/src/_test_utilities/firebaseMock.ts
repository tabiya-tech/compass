export const defaultMockFirebaseImplementation = {
  initializeApp: jest.fn(),
  auth: jest.fn().mockReturnValue({
    signInWithPopup: jest.fn().mockResolvedValue({ user: { uid: "123" } }),
    createUserWithEmailAndPassword: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    signInWithCustomToken: jest.fn(),
    signOut: jest.fn(),
    GoogleAuthProvider: jest.fn().mockReturnValue({
      PROVIDER_ID: "google.com",
    }),
    FacebookAuthProvider: jest.fn().mockReturnValue({
      PROVIDER_ID: "facebook.com",
    }),
  }),
  PROVIDER_ID: {
    GOOGLE: "google.com",
    FACEBOOK: "facebook.com",
  },
};

let mockFirebaseImplementation = { ...defaultMockFirebaseImplementation };

const firebase = {
  initializeApp: mockFirebaseImplementation.initializeApp,
  auth: mockFirebaseImplementation.auth,
  __esModule: true,
};

export default firebase;
