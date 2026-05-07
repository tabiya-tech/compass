import { getBackendUrl } from "src/envService";
import { getAuthHeaders, handleResponse } from "src/pages/Users/usersService";

export enum RegistrationStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export enum RegistrationRoleRequest {
  ADMIN = "admin",
  INSTITUTION_STAFF = "institution_staff",
}

export interface AdminRegistration {
  id: string;
  email: string;
  name: string;
  requested_role: RegistrationRoleRequest;
  institution_id: string | null;
  status: RegistrationStatus;
  submitted_at: string;
  decided_at: string | null;
  decided_by: string | null;
  rejection_reason: string | null;
}

export interface CreateRegistrationRequest {
  email: string;
  name: string;
  requested_role: RegistrationRoleRequest;
  institution_id?: string;
}

export interface CreateRegistrationResponse {
  id: string;
  status: RegistrationStatus;
}

export interface RegistrationStatusResponse {
  email: string;
  status: RegistrationStatus | null;
}

export interface ListRegistrationsResponse {
  registrations: AdminRegistration[];
  pending_count: number;
}

export const registrationsService = {
  async submit(request: CreateRegistrationRequest): Promise<CreateRegistrationResponse> {
    const base = getBackendUrl();
    const response = await fetch(`${base}/admin-registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return handleResponse<CreateRegistrationResponse>(response);
  },

  async getStatus(email: string): Promise<RegistrationStatusResponse> {
    const base = getBackendUrl();
    const params = new URLSearchParams({ email });
    const response = await fetch(`${base}/admin-registrations/status?${params}`, {
      method: "GET",
    });
    return handleResponse<RegistrationStatusResponse>(response);
  },

  async list(status?: RegistrationStatus): Promise<ListRegistrationsResponse> {
    const base = getBackendUrl();
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const url = params.toString() ? `${base}/admin-registrations?${params}` : `${base}/admin-registrations`;
    const response = await fetch(url, { method: "GET", headers: getAuthHeaders() });
    return handleResponse<ListRegistrationsResponse>(response);
  },

  async approve(id: string): Promise<AdminRegistration> {
    const base = getBackendUrl();
    const response = await fetch(`${base}/admin-registrations/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    return handleResponse<AdminRegistration>(response);
  },

  async reject(id: string, reason: string): Promise<AdminRegistration> {
    const base = getBackendUrl();
    const response = await fetch(`${base}/admin-registrations/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    return handleResponse<AdminRegistration>(response);
  },
};
