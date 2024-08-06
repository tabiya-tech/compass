import "src/_test_utilities/consoleMock";

import { useContext } from "react";
import {
  InvitationsContext,
  invitationsContextDefaultValue,
} from "src/invitations/InvitationsProvider/InvitationsProvider";
import { renderHook } from "src/_test_utilities/test-utils";
import { act } from "@testing-library/react";
import InvitationsService from "src/invitations/InvitationsService/invitations.service";
import { Invitation, InvitationStatus, InvitationType } from "src/invitations/InvitationsService/invitations.types";

const renderInvitationsContext = () => renderHook(() => useContext(InvitationsContext));

describe("InvitationsProvider module", () => {
  let invitationsService: InvitationsService;

  beforeEach(() => {
    invitationsService = InvitationsService.getInstance();
    jest.useFakeTimers();
  });

  const givenInvitation: Invitation = {
    invitation_code: "123",
    status: InvitationStatus.VALID,
    invitation_type: InvitationType.REGISTER,
  };
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe("Check invitation status functionality", () => {
    test("should call the error callback on failure", async () => {
      // Simulate failure response
      invitationsService.checkInvitationCodeStatus = jest.fn().mockRejectedValueOnce({
        code: "auth/internal-error",
        message: "Internal error",
      });

      // GIVEN: The InvitationsProvider is rendered and invitations context is accessed
      const { result } = renderInvitationsContext();

      // AND some callback functions
      const givenSuccessCallback = jest.fn();
      const givenErrorCallback = jest.fn();

      // WHEN the checkInvitationStatus function is called
      const checkInvitationCodeStatusSpy = jest.spyOn(invitationsService, "checkInvitationCodeStatus");

      await act(async () => {
        await result.current.checkInvitationStatus(
          givenInvitation.invitation_code,
          givenSuccessCallback,
          givenErrorCallback
        );
      });

      // THEN the invitations service checkInvitationCodeStatus function should be called with the correct parameters
      expect(checkInvitationCodeStatusSpy).toHaveBeenCalledWith(givenInvitation.invitation_code);

      // AND the error callback should be called
      expect(givenErrorCallback).toHaveBeenCalled();
      // AND the success callback should not be called
      expect(givenSuccessCallback).not.toHaveBeenCalled();
    });
  });

  describe("invitationsContextDefaultValue", () => {
    test("should return the default values", () => {
      // GIVEN: Default values for the InvitationsContext
      const givenInvitationsContextDefaultValue = invitationsContextDefaultValue;

      // THEN: The default values should be as expected
      expect(givenInvitationsContextDefaultValue.invitation).toBeNull();
      expect(givenInvitationsContextDefaultValue.isInvitationCheckLoading).toBe(false);
    });
  });
});
