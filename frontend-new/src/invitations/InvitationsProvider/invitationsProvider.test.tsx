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
import { TestUser } from "src/_test_utilities/mockLoggedInUser";
import { AnonymousAuthContext } from "../../auth/anonymousAuth/AnonymousAuthProvider/AnonymousAuthProvider";

const renderInvitationsContext = () => renderHook(() => useContext(InvitationsContext));
const renderAnonymousAuthContext = () => renderHook(() => useContext(AnonymousAuthContext));

describe("InvitationsProvider module", () => {
  let invitationsService: InvitationsService;

  beforeEach(() => {
    invitationsService = InvitationsService.getInstance();
    jest.useFakeTimers();
  });

  const givenInvitation: Invitation = {
    code: "123",
    status: InvitationStatus.VALID,
    invitation_type: InvitationType.REGISTER,
  };
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe("Check invitation status functionality", () => {
    test("should call the checkInvitationCodeStatus service with the correct parameters when the InvitationType is AUTO_REGISTER", async () => {
      // GIVEN the anonymous login will happen successfully
      const { result: anonymousAuthContextResult } = renderAnonymousAuthContext();
      jest
        .spyOn(anonymousAuthContextResult.current, "loginAnonymously")
        .mockImplementationOnce((successCallback, _errorCallback) => {
          successCallback(TestUser);
        });
      // AND the InvitationsProvider is rendered and invitations context is accessed
      const givenInvitation: Invitation = {
        code: "123",
        status: InvitationStatus.VALID,
        invitation_type: InvitationType.AUTO_REGISTER,
      };
      const { result: invitationContextResult } = renderInvitationsContext();
      invitationsService.checkInvitationCodeStatus = jest.fn().mockResolvedValue(givenInvitation);
      // AND some callback functions
      const givenSuccessCallback = jest.fn();
      const givenErrorCallback = jest.fn();

      // WHEN the checkInvitationStatus function is called

      const checkInvitationCodeStatusSpy = jest.spyOn(invitationsService, "checkInvitationCodeStatus");

      // initially isLoading should be false
      expect(invitationContextResult.current.isInvitationCheckLoading).toBe(false);

      await act(async () => {
        await invitationContextResult.current.checkInvitationStatus(
          givenInvitation.code,
          givenSuccessCallback,
          givenErrorCallback
        );
      });

      // THEN the invitations service checkInvitationCodeStatus function should be called with the correct parameters
      expect(checkInvitationCodeStatusSpy).toHaveBeenCalledWith(givenInvitation.code);

      // AND isLoading should be false
      expect(invitationContextResult.current.isInvitationCheckLoading).toBe(false);
    });
    test("should call the error callback on failure", async () => {
      // Simulate failure response
      invitationsService.checkInvitationCodeStatus = jest.fn().mockRejectedValue(new Error("Internal Server Error"));

      // GIVEN: The InvitationsProvider is rendered and invitations context is accessed
      const { result } = renderInvitationsContext();

      // AND some callback functions
      const givenSuccessCallback = jest.fn();
      const givenErrorCallback = jest.fn();

      // WHEN the checkInvitationStatus function is called
      const checkInvitationCodeStatusSpy = jest.spyOn(invitationsService, "checkInvitationCodeStatus");

      await act(async () => {
        await result.current.checkInvitationStatus(givenInvitation.code, givenSuccessCallback, givenErrorCallback);
      });

      // THEN the invitations service checkInvitationCodeStatus function should be called with the correct parameters
      expect(checkInvitationCodeStatusSpy).toHaveBeenCalledWith(givenInvitation.code);

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
