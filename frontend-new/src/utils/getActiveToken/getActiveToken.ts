import { jwtDecode } from "jwt-decode";
import { auth } from "src/auth/firebaseConfig";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

type DecodedToken = {
  exp: number;
};

/**
 * Get a refreshed token from the firebase auth service
 * @returns {string} The refreshed token
 */
const getRefreshedToken = async (): Promise<string> => {
  let refreshed_token = await auth.currentUser?.getIdToken(true);

  if (refreshed_token) PersistentStorageService.setToken(refreshed_token);

  return refreshed_token!;
};

/**
 * The number of seconds before the token expiration time that the token should be refreshed
 */
const EXPIRATION_TOLERANCE = 300; // 5 minutes, 300 seconds

/**
 * Get the active access token from the local storage
 * If the token has expired, refresh it
 * @returns {string} The active access token
 */
export async function getActiveToken(): Promise<string> {
  let token = PersistentStorageService.getToken();

  // if no token avaialble, get a refreshed one
  if (!token) {
    return getRefreshedToken();
  }

  let decodedToken: DecodedToken = jwtDecode<DecodedToken>(token);

  // Check if the token has expired
  // if the token has expired, return a refreshed one
  if (decodedToken.exp - EXPIRATION_TOLERANCE < Date.now() / 1000) {
    return getRefreshedToken();
  }

  return token;
}
