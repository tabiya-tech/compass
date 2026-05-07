// mock the console logs
import "src/_test_utilities/consoleMock";

import UserStateService from "src/userState/UserStateService";
import { UserState, getInstitutionId } from "src/userState/UserState.types";
import { Role, AccessRole } from "src/auth/services/FirebaseAuthenticationService/types";

function getMockAdminUserState(): UserState {
  return {
    id: `admin-user-${Math.random().toString(36).substring(7)}`,
    name: "Admin User",
    email: "admin@example.com",
    accessRole: { role: Role.ADMIN },
  };
}

function getMockSuperAdminUserState(): UserState {
  return {
    id: `super-admin-user-${Math.random().toString(36).substring(7)}`,
    name: "Super Admin User",
    email: "super@example.com",
    accessRole: { role: Role.SUPER_ADMIN },
  };
}

function getMockInstitutionStaffUserState(): UserState {
  return {
    id: `staff-user-${Math.random().toString(36).substring(7)}`,
    name: "Staff User",
    email: "staff@example.com",
    accessRole: {
      role: Role.INSTITUTION_STAFF,
      institutionId: `institution-${Math.random().toString(36).substring(7)}`,
    },
  };
}

describe("UserStateService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("UserStateService Singleton", () => {
    test("should get a single instance successfully", () => {
      // WHEN the service is constructed
      const actualFirstInstance = UserStateService.getInstance();

      // THEN expect the service to be constructed successfully
      expect(actualFirstInstance).toBeDefined();

      // AND WHEN the service is constructed again
      const actualSecondInstance = UserStateService.getInstance();

      // THEN expect the second instance to be the same as the first instance
      expect(actualFirstInstance).toBe(actualSecondInstance);
    });
  });

  describe("UserStateService methods", () => {
    let service: UserStateService;

    beforeEach(() => {
      service = UserStateService.getInstance();
      service.clearUserState();
    });

    describe("getUserState", () => {
      test("should return null when no user state is set", () => {
        // GIVEN the user state is newly cleared
        service.clearUserState();

        // WHEN getUserState is called
        const actualUserState = service.getUserState();

        // THEN expect the user state to be null
        expect(actualUserState).toBeNull();
      });

      test("should get a deep clone of the user state for admin user", () => {
        // GIVEN an admin user state that is set
        const givenUserState: UserState = getMockAdminUserState();
        service.setUserState(givenUserState);

        // WHEN getting the user state
        const actualUserState = service.getUserState();
        // guard
        expect(actualUserState).not.toBeNull();

        // AND mutating the retrieved user state
        const givenMutatedUserId = `${actualUserState?.id}_mutated`;
        // @ts-ignore actualUserState is not null, test is checked above
        actualUserState.id = givenMutatedUserId;
        // guard
        expect(actualUserState?.id).toEqual(givenMutatedUserId);

        // THEN the stored user state should not be mutated
        const actualUserStateSecond = service.getUserState();
        expect(actualUserStateSecond).not.toEqual(actualUserState);
        expect(actualUserStateSecond).toEqual(givenUserState);
      });

      test("should get a deep clone of the user state for institution staff user", () => {
        // GIVEN an institution staff user state that is set
        const givenUserState: UserState = getMockInstitutionStaffUserState();
        service.setUserState(givenUserState);

        // WHEN getting the user state
        const actualUserState = service.getUserState();
        // guard
        expect(actualUserState).not.toBeNull();

        // AND mutating the retrieved user state
        const givenMutatedEmail = `${actualUserState?.email}_mutated`;
        // @ts-ignore actualUserState is not null, test is checked above
        actualUserState.email = givenMutatedEmail;
        // guard
        expect(actualUserState?.email).toEqual(givenMutatedEmail);

        // THEN the stored user state should not be mutated
        const actualUserStateSecond = service.getUserState();
        expect(actualUserStateSecond).not.toEqual(actualUserState);
        expect(actualUserStateSecond).toEqual(givenUserState);
      });

      test("should return null when an error occurs while cloning the object", () => {
        // GIVEN some user state that is set
        const givenUserState: UserState = getMockAdminUserState();
        service.setUserState(givenUserState);

        // AND the JSON.stringify function will throw an error
        jest.spyOn(JSON, "stringify").mockImplementationOnce(() => {
          throw new Error("error");
        });

        // WHEN getting the user state
        const actualUserState = service.getUserState();

        // THEN expect the user state to be null
        expect(actualUserState).toBeNull();

        // AND expect an error to be logged
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe("setUserState", () => {
      test("should set a deep clone of the user state", () => {
        // GIVEN an admin user state
        const givenUserState: UserState = getMockAdminUserState();
        const givenOriginalUserId = givenUserState.id;

        // WHEN setting the user state
        service.setUserState(givenUserState);
        // AND mutating the original user state
        const givenMutatedUserId = `${givenOriginalUserId}_mutated`;
        givenUserState.id = givenMutatedUserId;
        // guard
        expect(givenUserState.id).toEqual(givenMutatedUserId);

        // THEN the stored user state should not be mutated
        const actualUserState = service.getUserState();
        expect(actualUserState).not.toBeNull();
        expect(actualUserState).not.toEqual(givenUserState);
        expect(actualUserState?.id).toEqual(givenOriginalUserId);
      });

      test("throws an error when the user state cannot be cloned", () => {
        // GIVEN some user state
        const givenUserState: UserState = getMockAdminUserState();

        // AND the JSON.stringify function will throw an error
        jest.spyOn(JSON, "stringify").mockImplementationOnce(() => {
          throw new Error("error");
        });

        // WHEN setting the user state
        // THEN expect an error to be thrown
        expect(() => service.setUserState(givenUserState)).toThrow();
      });
    });

    describe("get/setUserState", () => {
      test("should set and get admin user state correctly", () => {
        // GIVEN admin user state
        const givenUserState: UserState = getMockAdminUserState();

        // WHEN setUserState and getUserState are called
        service.setUserState(givenUserState);
        const actualUserState = service.getUserState();

        // THEN the given user state to be returned
        expect(actualUserState).toEqual(givenUserState);
      });

      test("should set and get institution staff user state correctly", () => {
        // GIVEN institution staff user state
        const givenUserState: UserState = getMockInstitutionStaffUserState();

        // WHEN setUserState and getUserState are called
        service.setUserState(givenUserState);
        const actualUserState = service.getUserState();

        // THEN the given user state to be returned
        expect(actualUserState).toEqual(givenUserState);
      });
    });

    describe("clearUserState", () => {
      test("should return null when user state is cleared", () => {
        // GIVEN user state is set
        service.setUserState(getMockAdminUserState());
        // guard
        expect(service.getUserState()).not.toBeNull();

        // WHEN clearUserState is called
        service.clearUserState();

        // THEN expect the user state to be null
        const actualUserState = service.getUserState();
        expect(actualUserState).toBeNull();
      });
    });

    describe("getUserId", () => {
      test("should return the user ID when user state is set", () => {
        // GIVEN user state is set
        const givenUserState: UserState = getMockAdminUserState();
        service.setUserState(givenUserState);

        // WHEN getUserId is called
        const actualUserId = service.getUserId();

        // THEN expected user ID
        expect(actualUserId).toBe(givenUserState.id);
      });

      test("should return null when no user state is set", () => {
        // GIVEN no user state is set
        service.clearUserState();

        // WHEN getUserId is called
        const actualUserId = service.getUserId();

        // THEN expected null
        expect(actualUserId).toBeNull();
      });
    });

    describe("getUserName", () => {
      test("should return the user name when user state is set", () => {
        // GIVEN user state is set
        const givenUserState: UserState = getMockAdminUserState();
        service.setUserState(givenUserState);

        // WHEN getUserName is called
        const actualUserName = service.getUserName();

        // THEN expected user name
        expect(actualUserName).toBe(givenUserState.name);
      });

      test("should return null when no user state is set", () => {
        // GIVEN no user state is set
        service.clearUserState();

        // WHEN getUserName is called
        const actualUserName = service.getUserName();

        // THEN expected null
        expect(actualUserName).toBeNull();
      });
    });

    describe("getUserEmail", () => {
      test("should return the user email when user state is set", () => {
        // GIVEN user state is set
        const givenUserState: UserState = getMockAdminUserState();
        service.setUserState(givenUserState);

        // WHEN getUserEmail is called
        const actualUserEmail = service.getUserEmail();

        // THEN expected user email
        expect(actualUserEmail).toBe(givenUserState.email);
      });

      test("should return null when no user state is set", () => {
        // GIVEN no user state is set
        service.clearUserState();

        // WHEN getUserEmail is called
        const actualUserEmail = service.getUserEmail();

        // THEN expected null
        expect(actualUserEmail).toBeNull();
      });
    });

    describe("getAccessRole", () => {
      test("should return the access role for admin user", () => {
        // GIVEN admin user state is set
        const givenUserState: UserState = getMockAdminUserState();
        service.setUserState(givenUserState);

        // WHEN getAccessRole is called
        const actualAccessRole = service.getAccessRole();

        // THEN expected access role
        expect(actualAccessRole).toEqual(givenUserState.accessRole);
      });

      test("should return the access role for institution staff user", () => {
        // GIVEN institution staff user state is set
        const givenUserState: UserState = getMockInstitutionStaffUserState();
        service.setUserState(givenUserState);

        // WHEN getAccessRole is called
        const actualAccessRole = service.getAccessRole();

        // THEN expected access role
        expect(actualAccessRole).toEqual(givenUserState.accessRole);
      });

      test("should return a copy of the access role to prevent mutation", () => {
        // GIVEN institution staff user state is set
        const givenUserState: UserState = getMockInstitutionStaffUserState();
        service.setUserState(givenUserState);

        // WHEN getAccessRole is called
        const actualAccessRole = service.getAccessRole() as AccessRole & { institutionId: string };
        // guard
        expect(actualAccessRole).not.toBeNull();

        // AND mutating the retrieved access role
        const givenMutatedInstitutionId = `${actualAccessRole.institutionId}_mutated`;
        actualAccessRole.institutionId = givenMutatedInstitutionId;
        // guard
        expect(actualAccessRole.institutionId).toEqual(givenMutatedInstitutionId);

        // THEN the stored access role should not be mutated
        const actualAccessRoleSecond = service.getAccessRole();
        expect(actualAccessRoleSecond).not.toEqual(actualAccessRole);
        expect(actualAccessRoleSecond).toEqual(givenUserState.accessRole);
      });

      test("should return null when no user state is set", () => {
        // GIVEN no user state is set
        service.clearUserState();

        // WHEN getAccessRole is called
        const actualAccessRole = service.getAccessRole();

        // THEN expected null
        expect(actualAccessRole).toBeNull();
      });
    });

    describe("getInstitutionId", () => {
      test("should return the institution ID for institution staff user", () => {
        // GIVEN institution staff user state is set
        const givenUserState: UserState = getMockInstitutionStaffUserState();
        service.setUserState(givenUserState);

        // WHEN getInstitutionId is called
        const actualInstitutionId = service.getInstitutionId();

        // THEN expected institution ID
        expect(actualInstitutionId).toBe((givenUserState.accessRole as { institutionId: string }).institutionId);
      });

      test("should return null for admin user", () => {
        // GIVEN admin user state is set
        const givenUserState: UserState = getMockAdminUserState();
        service.setUserState(givenUserState);

        // WHEN getInstitutionId is called
        const actualInstitutionId = service.getInstitutionId();

        // THEN expected null
        expect(actualInstitutionId).toBeNull();
      });

      test("should return null when no user state is set", () => {
        // GIVEN no user state is set
        service.clearUserState();

        // WHEN getInstitutionId is called
        const actualInstitutionId = service.getInstitutionId();

        // THEN expected null
        expect(actualInstitutionId).toBeNull();
      });
    });

    describe("isSuperAdmin", () => {
      test("should return true for super admin user", () => {
        // GIVEN a super admin user state is set
        const givenUserState: UserState = getMockSuperAdminUserState();
        service.setUserState(givenUserState);

        // WHEN isSuperAdmin is called
        const actualIsSuperAdmin = service.isSuperAdmin();

        // THEN expected true
        expect(actualIsSuperAdmin).toBe(true);
      });

      test("should return false for admin user", () => {
        // GIVEN an admin (not super admin) user state is set
        const givenUserState: UserState = getMockAdminUserState();
        service.setUserState(givenUserState);

        // WHEN isSuperAdmin is called
        const actualIsSuperAdmin = service.isSuperAdmin();

        // THEN expected false
        expect(actualIsSuperAdmin).toBe(false);
      });

      test("should return false when no user state is set", () => {
        // GIVEN no user state is set
        service.clearUserState();

        // WHEN isSuperAdmin is called
        const actualIsSuperAdmin = service.isSuperAdmin();

        // THEN expected false
        expect(actualIsSuperAdmin).toBe(false);
      });
    });

    describe("isAdmin", () => {
      test("should return true for admin user", () => {
        // GIVEN admin user state is set
        const givenUserState: UserState = getMockAdminUserState();
        service.setUserState(givenUserState);

        // WHEN isAdmin is called
        const actualIsAdmin = service.isAdmin();

        // THEN expected true
        expect(actualIsAdmin).toBe(true);
      });

      test("should return false for institution staff user", () => {
        // GIVEN institution staff user state is set
        const givenUserState: UserState = getMockInstitutionStaffUserState();
        service.setUserState(givenUserState);

        // WHEN isAdmin is called
        const actualIsAdmin = service.isAdmin();

        // THEN expected false
        expect(actualIsAdmin).toBe(false);
      });

      test("should return false when no user state is set", () => {
        // GIVEN no user state is set
        service.clearUserState();

        // WHEN isAdmin is called
        const actualIsAdmin = service.isAdmin();

        // THEN expected false
        expect(actualIsAdmin).toBe(false);
      });
    });

    describe("isInstitutionStaff", () => {
      test("should return true for institution staff user", () => {
        // GIVEN institution staff user state is set
        const givenUserState: UserState = getMockInstitutionStaffUserState();
        service.setUserState(givenUserState);

        // WHEN isInstitutionStaff is called
        const actualIsInstitutionStaff = service.isInstitutionStaff();

        // THEN expected true
        expect(actualIsInstitutionStaff).toBe(true);
      });

      test("should return false for admin user", () => {
        // GIVEN admin user state is set
        const givenUserState: UserState = getMockAdminUserState();
        service.setUserState(givenUserState);

        // WHEN isInstitutionStaff is called
        const actualIsInstitutionStaff = service.isInstitutionStaff();

        // THEN expected false
        expect(actualIsInstitutionStaff).toBe(false);
      });

      test("should return false when no user state is set", () => {
        // GIVEN no user state is set
        service.clearUserState();

        // WHEN isInstitutionStaff is called
        const actualIsInstitutionStaff = service.isInstitutionStaff();

        // THEN expected false
        expect(actualIsInstitutionStaff).toBe(false);
      });
    });
  });
});

describe("getInstitutionId helper function", () => {
  test("should return institution ID for institution staff user state", () => {
    // GIVEN institution staff user state
    const givenUserState: UserState = {
      id: "staff-123",
      name: "Staff User",
      email: "staff@example.com",
      accessRole: { role: Role.INSTITUTION_STAFF, institutionId: "institution-456" },
    };

    // WHEN getInstitutionId is called
    const actualInstitutionId = getInstitutionId(givenUserState);

    // THEN expected institution ID
    expect(actualInstitutionId).toBe("institution-456");
  });

  test("should return null for admin user state", () => {
    // GIVEN admin user state
    const givenUserState: UserState = {
      id: "admin-123",
      name: "Admin User",
      email: "admin@example.com",
      accessRole: { role: Role.ADMIN },
    };

    // WHEN getInstitutionId is called
    const actualInstitutionId = getInstitutionId(givenUserState);

    // THEN expected null
    expect(actualInstitutionId).toBeNull();
  });

  test("should return null for null user state", () => {
    // GIVEN null user state
    const givenUserState: UserState | null = null;

    // WHEN getInstitutionId is called
    const actualInstitutionId = getInstitutionId(givenUserState);

    // THEN expected null
    expect(actualInstitutionId).toBeNull();
  });
});
