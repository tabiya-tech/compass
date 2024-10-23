import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { getFirebaseAPIKey, getFirebaseDomain } from "src/envService";

// Get the firebase config from the environment variables
const firebaseConfig = {
  apiKey: getFirebaseAPIKey(),
  authDomain: getFirebaseDomain() + ".firebaseapp.com",
};

// Initialize the firebase app if it hasn't been initialized yet
firebase.initializeApp(firebaseConfig);

const firebaseAuth = firebase.auth(); // REVIEW would have been nice to name this firebaseAuth but ok.

export { firebaseAuth };
