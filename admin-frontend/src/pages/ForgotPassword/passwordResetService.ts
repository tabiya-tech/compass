import { getBackendUrl } from "src/envService";

export const passwordResetService = {
  /**
   * Request a password reset link. Always resolves successfully — the backend returns
   * 204 regardless of whether the email exists, to prevent account enumeration.
   */
  async requestReset(email: string): Promise<void> {
    const base = getBackendUrl();
    await fetch(`${base}/password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  },
};
