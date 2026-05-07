export enum Role {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  INSTITUTION_STAFF = "institution_staff",
}

export type AccessRole =
  | {
      role: Role.SUPER_ADMIN;
    }
  | {
      role: Role.ADMIN;
    }
  | {
      role: Role.INSTITUTION_STAFF;
      institutionId: string;
    };

export function buildAccessRole(input: object): AccessRole | null {
  // If invalid object, return null
  if (!input || typeof input !== "object") {
    return null;
  }

  const { role, institutionId } = input as { role?: string; institutionId?: string };

  // If no role, return null
  if (!role) {
    return null;
  }

  // If institution staff and no institution id, log error and return null
  if (role === Role.INSTITUTION_STAFF && !institutionId) {
    console.error("Institution staff role requires an institution ID");
    return null;
  }

  // If admin and has institution id, log warning and return { role: admin } only
  if (role === Role.ADMIN && institutionId) {
    console.warn("Admin role does not require institution ID, ignoring it");
    return { role: Role.ADMIN };
  }

  // If super_admin and has institution id, log warning and return { role: super_admin } only
  if (role === Role.SUPER_ADMIN && institutionId) {
    console.warn("Super admin role does not require institution ID, ignoring it");
    return { role: Role.SUPER_ADMIN };
  }

  // Return appropriate role
  if (role === Role.SUPER_ADMIN) {
    return { role: Role.SUPER_ADMIN };
  }

  if (role === Role.ADMIN) {
    return { role: Role.ADMIN };
  }

  if (role === Role.INSTITUTION_STAFF && institutionId) {
    return { role: Role.INSTITUTION_STAFF, institutionId };
  }

  // If role is not recognized, return null
  return null;
}
