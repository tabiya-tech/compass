import { useCallback, useEffect, useState } from "react";
import { AdminRegistration, RegistrationStatus, registrationsService } from "src/pages/Register/registrationsService";
import FirebaseEmailAuthenticationService from "src/auth/services/FirebaseAuthenticationService/FirebaseEmailAuthenticationService";

/**
 * Thrown when a backend operation succeeded but the follow-up Firebase
 * password-reset email send failed. The backend state is committed (user
 * created, registration approved) — only the email dispatch failed.
 */
export class EmailSendError extends Error {
  constructor(
    public readonly email: string,
    cause: unknown
  ) {
    super(`Failed to send password-reset email to ${email}`, { cause });
    this.name = "EmailSendError";
  }
}

export interface UsePendingRegistrationsValue {
  registrations: AdminRegistration[];
  pendingCount: number;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  approve: (id: string) => Promise<void>;
  reject: (id: string, reason: string) => Promise<void>;
  resendResetEmail: (email: string) => Promise<void>;
}

/**
 * Loads the pending-registration list and exposes approve/reject actions.
 * On approve, also triggers the Firebase password-reset email send. If the
 * email send fails, the backend approval is still committed — the hook
 * throws EmailSendError so the caller can show a Resend prompt.
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

  const approve = useCallback(
    async (id: string) => {
      const approved = await registrationsService.approve(id);
      await fetch();
      try {
        await FirebaseEmailAuthenticationService.getInstance().resetPassword(approved.email);
      } catch (e) {
        throw new EmailSendError(approved.email, e);
      }
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

  const resendResetEmail = useCallback(async (email: string) => {
    await FirebaseEmailAuthenticationService.getInstance().resetPassword(email);
  }, []);

  return { registrations, pendingCount, loading, error, fetch, approve, reject, resendResetEmail };
}
