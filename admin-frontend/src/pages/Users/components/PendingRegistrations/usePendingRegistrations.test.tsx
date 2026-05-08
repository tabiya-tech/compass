// mute the console
import "src/_test_utilities/consoleMock";

import { renderHook, act, waitFor } from "@testing-library/react";

import { usePendingRegistrations, EmailSendError } from "./usePendingRegistrations";
import { registrationsService, RegistrationStatus } from "src/pages/Register/registrationsService";

const mockResetPassword = jest.fn();
jest.mock("src/auth/services/FirebaseAuthenticationService/FirebaseEmailAuthenticationService", () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      resetPassword: (email: string) => mockResetPassword(email),
    }),
  },
}));

jest.mock("src/pages/Register/registrationsService", () => ({
  registrationsService: {
    list: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
  },
  RegistrationStatus: { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" },
}));

const givenApproved = {
  id: "reg-1",
  email: "alice@school.edu",
  name: "Alice",
  requested_role: "institution_staff",
  institution_id: "inst-1",
  status: RegistrationStatus.APPROVED,
  submitted_at: "2026-05-08T00:00:00Z",
  decided_at: "2026-05-08T00:00:01Z",
  decided_by: "super-1",
  rejection_reason: null,
};

describe("usePendingRegistrations approve flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (registrationsService.list as jest.Mock).mockResolvedValue({ registrations: [], pending_count: 0 });
    (registrationsService.approve as jest.Mock).mockResolvedValue(givenApproved);
  });

  test("calls Firebase resetPassword with the approved registration's email", async () => {
    // GIVEN approve resolves and Firebase send succeeds
    mockResetPassword.mockResolvedValue(undefined);

    // WHEN the hook is mounted enabled and approve is invoked
    const { result } = renderHook(() => usePendingRegistrations(true));
    await waitFor(() => expect(registrationsService.list).toHaveBeenCalled());
    await act(async () => {
      await result.current.approve("reg-1");
    });

    // THEN the backend approve was called with the registration id
    expect(registrationsService.approve).toHaveBeenCalledWith("reg-1");
    // AND Firebase resetPassword was called with the approved registration's email
    expect(mockResetPassword).toHaveBeenCalledWith(givenApproved.email);
  });

  test("throws EmailSendError when Firebase send fails after backend approval succeeds", async () => {
    // GIVEN approve resolves but Firebase send throws
    mockResetPassword.mockRejectedValue(new Error("network down"));

    // WHEN approve is invoked
    const { result } = renderHook(() => usePendingRegistrations(true));
    await waitFor(() => expect(registrationsService.list).toHaveBeenCalled());

    // THEN the hook surfaces an EmailSendError carrying the affected email
    let actualError: unknown = null;
    await act(async () => {
      try {
        await result.current.approve("reg-1");
      } catch (e) {
        actualError = e;
      }
    });
    expect(actualError).toBeInstanceOf(EmailSendError);
    expect((actualError as EmailSendError).email).toBe(givenApproved.email);
  });

  test("resendResetEmail proxies to Firebase resetPassword", async () => {
    // GIVEN Firebase send succeeds
    const givenEmail = "resend-me@school.edu";
    mockResetPassword.mockResolvedValue(undefined);

    // WHEN resendResetEmail is invoked
    const { result } = renderHook(() => usePendingRegistrations(true));
    await waitFor(() => expect(registrationsService.list).toHaveBeenCalled());
    await act(async () => {
      await result.current.resendResetEmail(givenEmail);
    });

    // THEN Firebase resetPassword was called with that email
    expect(mockResetPassword).toHaveBeenCalledWith(givenEmail);
  });
});
