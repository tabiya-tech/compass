// mute the console
import "src/_test_utilities/consoleMock";

import { renderHook, act, waitFor } from "@testing-library/react";

import { usePendingRegistrations } from "./usePendingRegistrations";
import { registrationsService, RegistrationStatus } from "src/pages/Register/registrationsService";
import { usersService } from "src/pages/Users/usersService";

jest.mock("src/pages/Register/registrationsService", () => ({
  registrationsService: {
    list: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
  },
  RegistrationStatus: { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" },
}));

jest.mock("src/pages/Users/usersService", () => ({
  usersService: {
    getPasswordResetLink: jest.fn(),
  },
}));

const givenApproveResponse = {
  registration: {
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
  },
  uid: "firebase-uid-1",
};

const givenResetLink = "https://auth.example.com/reset?oobCode=abc123";

describe("usePendingRegistrations approve flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (registrationsService.list as jest.Mock).mockResolvedValue({ registrations: [], pending_count: 0 });
    (registrationsService.approve as jest.Mock).mockResolvedValue(givenApproveResponse);
    (usersService.getPasswordResetLink as jest.Mock).mockResolvedValue({ reset_link: givenResetLink });
  });

  test("returns the password reset link after approval succeeds", async () => {
    // GIVEN approve and getPasswordResetLink both resolve

    // WHEN the hook is mounted enabled and approve is invoked
    const { result } = renderHook(() => usePendingRegistrations(true));
    await waitFor(() => expect(registrationsService.list).toHaveBeenCalled());

    let returnedLink: string | undefined;
    await act(async () => {
      returnedLink = await result.current.approve("reg-1");
    });

    // THEN the backend approve was called with the registration id
    expect(registrationsService.approve).toHaveBeenCalledWith("reg-1");
    // AND getPasswordResetLink was called with the new user's UID
    expect(usersService.getPasswordResetLink).toHaveBeenCalledWith(givenApproveResponse.uid);
    // AND the reset link is returned to the caller
    expect(returnedLink).toBe(givenResetLink);
  });

  test("throws when getPasswordResetLink fails after backend approval succeeds", async () => {
    // GIVEN approve resolves but getPasswordResetLink throws
    (usersService.getPasswordResetLink as jest.Mock).mockRejectedValue(new Error("network down"));

    // WHEN approve is invoked
    const { result } = renderHook(() => usePendingRegistrations(true));
    await waitFor(() => expect(registrationsService.list).toHaveBeenCalled());

    let actualError: unknown = null;
    await act(async () => {
      try {
        await result.current.approve("reg-1");
      } catch (e) {
        actualError = e;
      }
    });

    // THEN an error is surfaced to the caller
    expect(actualError).toBeInstanceOf(Error);
    expect((actualError as Error).message).toBe("network down");
  });
});
