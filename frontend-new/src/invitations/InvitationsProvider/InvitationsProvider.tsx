import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { Invitation, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import isEmptyObject from "src/utils/isEmptyObject/isEmptyObject";
import { AuthContext, TabiyaUser } from "src/auth/AuthProvider/AuthProvider";

export type InvitationsProviderProps = {
  children: ReactNode;
};

export interface InvitationsContextValue {
  invitation: Invitation | null;
  isInvitationCheckLoading: boolean;
  checkInvitationStatus: (
    code: string,
    successCallback: (user: TabiyaUser) => void,
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

  const { loginAnonymously } = useContext(AuthContext);

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
   * Check invitation status
   */
  const checkInvitationStatus = useCallback(
    async (code: string, successCallback: (user: TabiyaUser) => void, errorCallback: (error: any) => void) => {
      try {
        setIsInvitationCheckLoading(true);
        const newInvitation = await invitationsService.checkInvitationCodeStatus(code);
        console.log("Invitation check successful", newInvitation);
        setInvitation(newInvitation);
        if (newInvitation.invitation_type === InvitationType.AUTO_REGISTER) {
          // Log the user in anonymously if the invitation is for auto-register
          loginAnonymously(
            (user) => {
              console.log("Anonymous login successful", user);
              successCallback(user);
            },
            (error) => {
              console.error("Error during anonymous login", error);
              errorCallback(error);
            }
          );
        }
        setIsInvitationCheckLoading(false);
      } catch (error) {
        console.error(error);
        errorCallback(error);
        setIsInvitationCheckLoading(false);
      }
    },
    [setInvitation, loginAnonymously]
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
