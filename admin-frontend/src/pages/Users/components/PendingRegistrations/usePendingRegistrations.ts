import { useCallback, useEffect, useState } from "react";
import { AdminRegistration, RegistrationStatus, registrationsService } from "src/pages/Register/registrationsService";
import { usersService } from "src/pages/Users/usersService";

export interface UsePendingRegistrationsValue {
  registrations: AdminRegistration[];
  pendingCount: number;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  approve: (id: string) => Promise<string>;
  reject: (id: string, reason: string) => Promise<void>;
}

/**
 * Loads the pending-registration list and exposes approve/reject actions.
 * On approve, creates the Firebase user and returns a password reset link
 * for the super admin to share via any channel.
 */
export function usePendingRegistrations(enabled: boolean): UsePendingRegistrationsValue {
  const [registrations, setRegistrations] = useState<AdminRegistration[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await registrationsService.list(RegistrationStatus.PENDING);
      setRegistrations(result.registrations);
      setPendingCount(result.pending_count);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pending registrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void fetch();
    }
  }, [enabled, fetch]);

  /**
   * Approve a registration and return the password reset link for the new user.
   * The caller is responsible for displaying the link to the super admin.
   */
  const approve = useCallback(
    async (id: string): Promise<string> => {
      const { uid } = await registrationsService.approve(id);
      await fetch();
      const { reset_link } = await usersService.getPasswordResetLink(uid);
      return reset_link;
    },
    [fetch]
  );

  const reject = useCallback(
    async (id: string, reason: string) => {
      await registrationsService.reject(id, reason);
      await fetch();
    },
    [fetch]
  );

  return { registrations, pendingCount, loading, error, fetch, approve, reject };
}
