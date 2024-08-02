import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { Invitation, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import isEmptyObject from "src/utils/isEmptyObject/isEmptyObject";
import { AnonymousAuthContext, TabiyaUser } from "../../auth/anonymousAuth/AnonymousAuthProvider/AnonymousAuthProvider";

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

  const { loginAnonymously } = useContext(AnonymousAuthContext);

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
  const checkInvitationStatusAndSignInAnonymously = useCallback(
    async (code: string, successCallback: (user: TabiyaUser) => void, errorCallback: (error: any) => void) => {
      try {
        setIsInvitationCheckLoading(true);
        const newInvitation = await invitationsService.checkInvitationCodeStatus(code);
        setInvitation(newInvitation);
        if (newInvitation.invitation_type === InvitationType.AUTO_REGISTER) {
          // Log the user in anonymously if the invitation is for auto-register
          loginAnonymously(
            (user) => {
              successCallback(user);
            },
            (error) => {
              console.error("Error during anonymous login", error);
              errorCallback(error);
            }
          );
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
    [setInvitation, loginAnonymously]
  );

  const value = useMemo(
    () => ({
      invitation,
      isInvitationCheckLoading,
      checkInvitationStatus: checkInvitationStatusAndSignInAnonymously,
    }),
    [invitation, isInvitationCheckLoading, checkInvitationStatusAndSignInAnonymously]
  );

  return <InvitationsContext.Provider value={value}>{children}</InvitationsContext.Provider>;
};
