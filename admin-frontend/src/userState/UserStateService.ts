import { UserState } from "src/userState/UserState.types";
import { Role, AccessRole, buildAccessRole } from "src/auth/services/FirebaseAuthenticationService/types";

/**
 * UserStateService manages the user profile state for the admin application.
 * It provides methods to get, set, and clear the current user state, including
 * user ID, name, email, access role, and institution ID (when applicable).
 *
 * This is a singleton service that acts as the centralized store for user profile state.
 * It stores a deep copy of the user state to prevent direct modification of the stored data.
 */
export default class UserStateService {
  private static instance: UserStateService;
  private userState: UserState | null = null;

  private constructor() {}

  /**
   * Returns the singleton instance of UserStateService.
   * Creates a new instance if one doesn't exist.
   *
   * @returns {UserStateService} The singleton instance.
   */
  public static getInstance(): UserStateService {
    if (!UserStateService.instance) {
      UserStateService.instance = new UserStateService();
    }
    return UserStateService.instance;
  }

  /**
   * Retrieves the current user state.
   * It returns a deep copy of the user state object to prevent direct modification.
   *
   * @returns {UserState | null} The current user state object or null if no user state is set or
   * an error occurs while cloning the object.
   */
  public getUserState(): UserState | null {
    try {
      return this.cloneUserState(this.userState);
    } catch (e) {
      console.error(new Error("Error in getUserState", { cause: e }));
      return null;
    }
  }

  /**
   * Sets the current user state.
   * It stores a deep copy of the user state object to prevent direct modification.
   *
   * @param userState - The user state to set.
   */
  public setUserState(userState: UserState): void {
    // Store a deep copy of the user state object to prevent direct modification
    this.userState = this.cloneUserState(userState);
  }

  /**
   * Clears the current user state.
   */
  public clearUserState(): void {
    this.userState = null;
  }

  /**
   * Gets the user ID from the current user state.
   *
   * @returns {string | null} The user ID or null if no user state is set.
   */
  public getUserId(): string | null {
    return this.userState?.id ?? null;
  }

  /**
   * Gets the user name from the current user state.
   *
   * @returns {string | null} The user name or null if no user state is set.
   */
  public getUserName(): string | null {
    return this.userState?.name ?? null;
  }

  /**
   * Gets the user email from the current user state.
   *
   * @returns {string | null} The user email or null if no user state is set.
   */
  public getUserEmail(): string | null {
    return this.userState?.email ?? null;
  }

  /**
   * Gets the access role from the current user state.
   *
   * @returns {AccessRole | null} The access role or null if no user state is set.
   */
  public getAccessRole(): AccessRole | null {
    if (!this.userState) {
      return null;
    }
    // Return a copy of the access role to prevent mutation
    return { ...this.userState.accessRole } as AccessRole;
  }

  /**
   * Gets the institution ID from the current user state.
   * Returns null if the user is an admin (no institution) or if no user state is set.
   *
   * @returns {string | null} The institution ID or null.
   */
  public getInstitutionId(): string | null {
    if (!this.userState) {
      return null;
    }

    if ("institutionId" in this.userState.accessRole) {
      return this.userState.accessRole.institutionId;
    }

    return null;
  }

  /**
   * Checks if the current user is a super admin.
   *
   * @returns {boolean} True if the user is a super admin, false otherwise.
   */
  public isSuperAdmin(): boolean {
    return this.userState?.accessRole.role === Role.SUPER_ADMIN;
  }

  /**
   * Checks if the current user is an admin.
   *
   * @returns {boolean} True if the user is an admin, false otherwise.
   */
  public isAdmin(): boolean {
    return this.userState?.accessRole.role === Role.ADMIN;
  }

  /**
   * Checks if the current user is institution staff.
   *
   * @returns {boolean} True if the user is institution staff, false otherwise.
   */
  public isInstitutionStaff(): boolean {
    return this.userState?.accessRole.role === Role.INSTITUTION_STAFF;
  }

  /**
   * Creates a deep copy of the user state.
   *
   * @param userState - The user state to clone.
   * @returns {UserState | null} A deep copy of the user state or null if the input is null.
   */
  private cloneUserState(userState: UserState | null): UserState | null {
    if (!userState) {
      return userState;
    }

    const strObj = JSON.stringify(userState);
    return JSON.parse(strObj, (key, value) => {
      // Handle accessRole reconstruction
      if (key === "accessRole") {
        return buildAccessRole(value);
      }
      return value;
    });
  }
}
