# Admin & Instructor Registration

This document describes the self-service registration flow for admins (cross-institution) and instructors (institution-scoped), the super-admin approval workflow, and the one-time bootstrap step needed when standing up a new environment.

For end-user invitation/registration codes (job seekers), see [invitations.md](invitations.md).

## Roles

| Role | Scope | How they get access |
|------|-------|---------------------|
| `super_admin` | Manages users; approves sign-ups | Bootstrapped via CLI per env, or created from the admin dashboard by another super admin |
| `admin` | Cross-institution dashboard (read all institutions) | Self-service registration → super-admin approval |
| `institution_staff` (instructor) | Single institution, set via `institutionId` claim | Self-service registration → super-admin approval |

## Self-service registration flow

1. The user opens the admin frontend at `/#/register` (no auth required).
2. They submit `{email, name, requested_role, institution_id?}`. `institution_id` is required for instructors and forbidden for admins.
3. The backend creates a row in the `admin_registrations` MongoDB collection with `status: pending`. No Firebase user is created at this stage.
4. The login page surfaces "Your registration is still pending approval" if the user tries to sign in before approval.
5. A super admin reviews the queue at `/#/users?tab=pending` (header badge shows the count) and clicks Approve or Reject.
6. On **approve**: the backend creates the Firebase user under the admin tenant, writes the `access_roles` document in Firestore, and generates a password-reset link (currently logged — see "Email delivery" below).
7. On **reject**: the row is marked rejected with a reason. A future submission for the same email overwrites the rejected row.

Re-submission rules:
- One active row per email (`pending` or `approved`) — second submission returns `409 Conflict`.
- A `rejected` row is overwritten cleanly by a new submission.
- The public status endpoint returns `{status: null}` for unknown emails — no account enumeration.

## Bootstrapping the first super admin (per environment)

The dashboard self-creation flow requires an existing super admin to approve / promote others. The first super admin in each environment must be created with the existing `create_admin_user.py` CLI:

```bash
cd backend
poetry run python scripts/admin/create_admin_user.py \
  --name "Compass Super Admin" \
  --email "superadmin@<env>.example.com" \
  --role super_admin \
  --tenant-id "$ADMIN_FIREBASE_TENANT_ID" \
  --project-id "<env-gcp-project-id>"
```

The script generates a random password and prints a Firebase password-reset link. Forward that link to the new super admin so they can set their password and log in. Once they're in, additional super admins, admins, and instructors can be created or approved entirely from the dashboard — no further CLI use is required.

The `--dry-run` flag previews the change without touching Firebase. See `scripts/admin/create_admin_user.py --help` for full options.

## Rate limits

The public registration and status-lookup endpoints are rate-limited per IP, in-memory:

| Endpoint | Limit |
|----------|-------|
| `POST /admin-registrations` | 5 / min / IP |
| `GET /admin-registrations/status` | 30 / min / IP |
| `POST /password-reset` | 5 / min / IP |

Limits are hardcoded constants in `backend/app/admin/registrations/rate_limit.py`. Because the limiter is in-memory, limits are per-replica — acceptable for current expected volume; revisit (move to Redis) if signup traffic grows or the backend scales beyond a single replica.

## Email delivery

The Firebase Identity Platform email templates (verification email, password-reset email) are already managed in IaC at `iac/auth/setup_identity_platform.py` via `EmailTemplateArgs.reset_password_template`. Any subject/sender/body changes belong there.

Currently the backend calls `auth_client.generate_password_reset_link(email)` after creating a user (both in `UsersService.create_user` and the approval path) and **logs the resulting link**. The dev team is expected to forward the link to the user out-of-band. Firebase does not auto-send when the link is generated this way.

To have Firebase deliver the email automatically using the configured template, the backend would need to call the Identity Toolkit REST endpoint `accounts:sendOobCode` with `requestType=PASSWORD_RESET` (and the admin tenant id). That replaces the "log the link" step in `UsersService.create_user`. No new IaC is needed — the template, custom domain, and verified sender are already deployed by `setup_identity_platform.py`.

## Permission boundaries

| Endpoint | Allowed callers |
|----------|-----------------|
| `POST /admin-registrations` | Public (rate-limited) |
| `GET /admin-registrations/status` | Public (rate-limited) |
| `GET /admin-registrations` | `super_admin` |
| `POST /admin-registrations/{id}/approve` | `super_admin` |
| `POST /admin-registrations/{id}/reject` | `super_admin` |
| `POST /password-reset` | Public (rate-limited; always 204, no enumeration) |
| `POST /admin/users` | `super_admin` |
| `DELETE /admin/users/{id}` | `super_admin` |
| `PATCH /admin/users/{id}/role` | `super_admin` |
| `GET /admin/users` | Any authenticated admin-tier role |
| `PATCH /admin/users/{id}/profile` | Any authenticated user (self-edit) |

The `super_admin` gate is enforced via the `get_super_admin_dependency` factory in `app/users/access_role.py`.
