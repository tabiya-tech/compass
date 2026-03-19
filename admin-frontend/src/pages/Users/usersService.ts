import { getBackendUrl } from "src/envService";

export enum Role {
  ADMIN = "admin",
  INSTITUTION_STAFF = "institution_staff",
}

export interface UserRecord {
  uid: string;
  email: string | null;
  display_name: string | null;
  phone_number: string | null;
  photo_url: string | null;
  disabled: boolean;
  email_verified: boolean;
  role: string | null;
  institution_id: string | null;
}

export interface ListUsersResponse {
  users: UserRecord[];
  next_page_token: string | null;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  role: Role;
  institution_id?: string;
}

export interface CreateUserResponse {
  uid: string;
  email: string;
  display_name: string;
  role: string;
  institution_id: string | null;
}

export interface UpdateRoleRequest {
  role: Role;
  institution_id?: string;
}

export interface UpdateRoleResponse {
  uid: string;
  role: string;
  institution_id: string | null;
}

export interface DeleteUserResponse {
  uid: string;
  deleted: boolean;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const TOKEN_KEY = "admin_token_0.0.1";

function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore parse errors
    }
    throw new HttpError(response.status, detail);
  }
  return response.json() as Promise<T>;
}

export const usersService = {
  async listUsers(maxResults = 100, pageToken?: string): Promise<ListUsersResponse> {
    const base = getBackendUrl();
    const params = new URLSearchParams({ max_results: String(maxResults) });
    if (pageToken) params.set("page_token", pageToken);
    const response = await fetch(`${base}/admin/users?${params}`, {
      method: "GET",
      headers: getHeaders(),
    });
    return handleResponse<ListUsersResponse>(response);
  },

  async createUser(request: CreateUserRequest): Promise<CreateUserResponse> {
    const base = getBackendUrl();
    const response = await fetch(`${base}/admin/users`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(request),
    });
    return handleResponse<CreateUserResponse>(response);
  },

  async deleteUser(userId: string): Promise<DeleteUserResponse> {
    const base = getBackendUrl();
    const response = await fetch(`${base}/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse<DeleteUserResponse>(response);
  },

  async updateRole(userId: string, request: UpdateRoleRequest): Promise<UpdateRoleResponse> {
    const base = getBackendUrl();
    const response = await fetch(`${base}/admin/users/${encodeURIComponent(userId)}/role`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(request),
    });
    return handleResponse<UpdateRoleResponse>(response);
  },
};
