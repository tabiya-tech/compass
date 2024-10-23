const auth = {
  currentUser: {
    getIdToken: jest.fn(),
    getTokenResult: jest.fn(),
  },
  onAuthStateChanged: jest.fn().mockReturnValue(jest.fn()),
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: { PROVIDER_ID: "google.com" },
};

const firebase = {
  initializeApp: jest.fn(),
  auth: () => auth,
};

export default firebase;
