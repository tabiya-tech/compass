import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { Invitation, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import isEmptyObject from "src/utils/isEmptyObject/isEmptyObject";

export type InvitationsProviderProps = {
  children: ReactNode;
};

export interface InvitationsContextValue {
  invitation: Invitation | null;
  isInvitationCheckLoading: boolean;
  checkInvitationStatus: (
    code: string,
    successCallback: (invitation: Invitation) => void,
    errorCallback: (error: any) => void
  ) => void;
}

export const invitationsContextDefaultValue: InvitationsContextValue = {
  invitation: null,
  isInvitationCheckLoading: false,
  checkInvitationStatus: () => {},
};

export const InvitationsContext = createContext<InvitationsContextValue>(invitationsContextDefaultValue);

export const InvitationsProvider: React.FC<InvitationsProviderProps> = ({ children }) => {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [isInvitationCheckLoading, setIsInvitationCheckLoading] = useState<boolean>(false);

  useEffect(() => {
    const storedInvitation = PersistentStorageService.getInvitation();
    if (storedInvitation) {
      setInvitation(storedInvitation);
    }
  }, []);

  useEffect(() => {
    if (invitation && !isEmptyObject(invitation)) {
      PersistentStorageService.setInvitation(invitation);
    } else {
      PersistentStorageService.clearInvitation();
    }
  }, [invitation]);

  /**
   * Check invitation status and sign in anonymously
   */
  const checkInvitationStatus = useCallback(
    async (code: string, successCallback: (invitation: Invitation) => void, errorCallback: (error: any) => void) => {
      try {
        setIsInvitationCheckLoading(true);
        const newInvitation = await invitationsService.checkInvitationCodeStatus(code);
        setInvitation(newInvitation);
        if (newInvitation.invitation_type === InvitationType.AUTO_REGISTER) {
          // checks that the invitation type is AUTO_REGISTER and calls the successCallback
          successCallback(newInvitation);
        } else {
          throw new Error("Invitation type is not AUTO_REGISTER");
        }
        setIsInvitationCheckLoading(false);
      } catch (error) {
        console.error(error);
        errorCallback(error);
        setIsInvitationCheckLoading(false);
      }
    },
    [setInvitation]
  );

  const value = useMemo(
    () => ({
      invitation,
      isInvitationCheckLoading,
      checkInvitationStatus,
    }),
    [invitation, isInvitationCheckLoading, checkInvitationStatus]
  );

  return <InvitationsContext.Provider value={value}>{children}</InvitationsContext.Provider>;
};
