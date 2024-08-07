import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { invitationsService } from "src/invitations/InvitationsService/invitations.service";
import { Invitation, InvitationType } from "src/invitations/InvitationsService/invitations.types";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";
import isEmptyObject from "src/utils/isEmptyObject/isEmptyObject";
import { AnonymousAuthContext, TabiyaUser } from "src/auth/anonymousAuth/AnonymousAuthProvider/AnonymousAuthProvider";
import { userPreferencesService } from "src/userPreferences/UserPreferencesService/userPreferences.service";
import { Language } from "src/userPreferences/UserPreferencesService/userPreferences.types";

export type InvitationsProviderProps = {
  children: ReactNode;
};

export interface InvitationsContextValue {
  invitation: Invitation | null;
  isInvitationCheckLoading: boolean;
  setInvitation: (invitation: Invitation | null) => void;
  checkInvitationStatus: (
    code: string,
    successCallback: (user: TabiyaUser) => void,
    errorCallback: (error: any) => void
  ) => void;
}

export const invitationsContextDefaultValue: InvitationsContextValue = {
  invitation: null,
  setInvitation: (_) => {},
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
        // step 1 Check invitation status
        setIsInvitationCheckLoading(true);
        const newInvitation = await invitationsService.checkInvitationCodeStatus(code);
        setInvitation(newInvitation);
        if (newInvitation.invitation_type === InvitationType.AUTO_REGISTER) {
          // Log the user in anonymously if the invitation is for auto-register
          // step 2 Sign in anonymously

          loginAnonymously(
            async (user) => {

              // step 3, create user preferences
              await userPreferencesService.createUserPreferences({
                invitation_code: code,
                user_id: user.id,
                language: Language.en
              })

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
      setInvitation,
      isInvitationCheckLoading,
      checkInvitationStatus: checkInvitationStatusAndSignInAnonymously,
    }),
    [invitation, isInvitationCheckLoading, checkInvitationStatusAndSignInAnonymously]
  );

  return <InvitationsContext.Provider value={value}>{children}</InvitationsContext.Provider>;
};
