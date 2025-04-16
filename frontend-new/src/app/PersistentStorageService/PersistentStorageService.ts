import { Invitation } from "src/auth/services/invitationsService/invitations.types";
import { StoredPersonalInfo } from "src/sensitiveData/types";
import { FeedbackItem } from "src/feedback/overallFeedback/overallFeedbackService/OverallFeedback.service.types";

const PERSISTENT_STORAGE_VERSION = "0.0.1";
export const TOKEN_KEY = `token_${PERSISTENT_STORAGE_VERSION}`;

export const INVITATION_KEY = `invitation_${PERSISTENT_STORAGE_VERSION}`;

export const LOGIN_METHOD_KEY = `login_method_${PERSISTENT_STORAGE_VERSION}`;

export const PERSONAL_INFO_KEY = `personal_info_${PERSISTENT_STORAGE_VERSION}`;

export const OVERALL_FEEDBACK_KEY = `overall_feedback_${PERSISTENT_STORAGE_VERSION}`;

export const ACCOUNT_CONVERTED_KEY = `account_converted_${PERSISTENT_STORAGE_VERSION}`;

export const FEEDBACK_NOTIFICATION_KEY = `feedback_notification_${PERSISTENT_STORAGE_VERSION}`;

/**
 * This class is used to store the tokens in the session storage.
 *   eg: refresh token
 */
export class PersistentStorageService {
  static readonly storage = localStorage;

  /**
   * Returns the token from the storage
   * @returns string | null - The token
   */
  static getToken(): string | null {
    return this.storage.getItem(TOKEN_KEY);
  }

  /**
   * Clears the token from the storage
   */
  static clearToken(): void {
    this.storage.removeItem(TOKEN_KEY);
  }

  /**
   * Sets the token in the storage
   * @param token
   */
  static setToken(token: string): void {
    this.storage.setItem(TOKEN_KEY, token);
  }

  /**
   * Returns the user's invitation details from the storage
   * @returns Invitation | null - The user's invitation details
   */
  static getInvitation(): Invitation | null {
    const item = this.storage.getItem(INVITATION_KEY);
    return item ? JSON.parse(item) : null;
  }

  /**
   * Sets the user's invitation details in the storage
   * @param invitation
   */
  static setInvitation(invitation: Invitation): void {
    this.storage.setItem(INVITATION_KEY, JSON.stringify(invitation));
  }

  /**
   * Clears the user's invitation details from the storage
   */
  static clearInvitation(): void {
    this.storage.removeItem(INVITATION_KEY);
  }

  /**
   * Sets the user's login method in the storage
   */
  static setLoginMethod(method: string): void {
    this.storage.setItem(LOGIN_METHOD_KEY, method);
  }

  /**
   * Returns the user's login method from the storage
   * @returns string | null - The user's login method
   */
  static getLoginMethod(): string | null {
    return this.storage.getItem(LOGIN_METHOD_KEY);
  }

  /**
   * Clears the user's login method from the storage
   */
  static clearLoginMethod(): void {
    this.storage.removeItem(LOGIN_METHOD_KEY);
  }

  /**
   * Returns the personalInfo from the storage
   * @returns StoredPersonalInfo | null - The personalInfo
   */
  static getPersonalInfo(): StoredPersonalInfo | null {
    const item = this.storage.getItem(PERSONAL_INFO_KEY);
    return item ? JSON.parse(item) : null;
  }

  /**
   * Sets the personalInfo in the storage
   * @param personalInfo
   */
  static setPersonalInfo(personalInfo: StoredPersonalInfo): void {
    this.storage.setItem(PERSONAL_INFO_KEY, JSON.stringify(personalInfo));
  }

  /**
   * Clears the personalInfo from the storage
   */
  static clearPersonalInfo(): void {
    this.storage.removeItem(PERSONAL_INFO_KEY);
  }

  /**
   * Returns the overall feedback from the storage
   * @returns FeedbackItem[] - The feedback
   */
  static getOverallFeedback(): FeedbackItem[] {
    const item = this.storage.getItem(OVERALL_FEEDBACK_KEY);
    return item ? JSON.parse(item) : [];
  }

  /**
   * Sets the overall feedback in the storage
   * @param feedback
   */
  static setOverallFeedback(feedback: FeedbackItem[]): void {
    this.storage.setItem(OVERALL_FEEDBACK_KEY, JSON.stringify(feedback));
  }

  /**
   * Clears the overall feedback from the storage
   */
  static clearOverallFeedback(): void {
    this.storage.removeItem(OVERALL_FEEDBACK_KEY);
  }

  /**
   * Returns whether the anonymous account has been converted to a registered account
   * @returns boolean - Whether the account has been converted
   */
  static getAccountConverted(): boolean {
    return this.storage.getItem(ACCOUNT_CONVERTED_KEY) === "true";
  }

  /**
   * Sets whether the anonymous account has been converted to a registered account
   * @param converted
   */
  static setAccountConverted(converted: boolean): void {
    this.storage.setItem(ACCOUNT_CONVERTED_KEY, converted.toString());
  }

  /**
   * Clears the account converted flag from storage
   */
  static clearAccountConverted(): void {
    this.storage.removeItem(ACCOUNT_CONVERTED_KEY);
  }

  /**
   * Returns whether feedback notification has been shown for the user
   * @param userId - ID of the user
   * @returns boolean - Whether the feedback notification has been shown
   */
  static hasSeenFeedbackNotification(userId: string): boolean {
    const usersStr = this.storage.getItem(FEEDBACK_NOTIFICATION_KEY);
    if (!usersStr) return false;
    const userIds: string[] = JSON.parse(usersStr);
    return userIds.includes(userId);
  }

  /**
   * Sets the feedback notification in the storage
   * @param userId - ID of the user
   */
  static setSeenFeedbackNotification(userId: string): void {
    const usersStr = this.storage.getItem(FEEDBACK_NOTIFICATION_KEY);
    const userIds: string[] = usersStr ? JSON.parse(usersStr) : [];

    if (!userIds.includes(userId)) {
      userIds.push(userId);
      this.storage.setItem(FEEDBACK_NOTIFICATION_KEY, JSON.stringify(userIds));
    }
  }

  /**
   * Clears the feedback notification from the storage
   * @param userId - ID of the user
   */
  static clearSeenFeedbackNotification(userId: string): void {
    const usersStr = this.storage.getItem(FEEDBACK_NOTIFICATION_KEY)
    if (!usersStr) return;

    const userIds: string[] = JSON.parse(usersStr);
    const updatedUserIds = userIds.filter(id => id !== userId);

    if (updatedUserIds.length === 0){
      this.storage.removeItem(FEEDBACK_NOTIFICATION_KEY);
    } else if (userIds.length !== updatedUserIds.length) {
      this.storage.setItem(FEEDBACK_NOTIFICATION_KEY, JSON.stringify(updatedUserIds));
    }
  }

  /**
   * Clears the storage
   */
  static clear(): void {
    this.storage.clear();
  }
}
