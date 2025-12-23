import React, { useState, useContext } from "react";
import { useTranslation } from "react-i18next";
import Typography from "@mui/material/Typography";
import * as Sentry from "@sentry/react";
import CustomLink from "src/theme/CustomLink/CustomLink";
import RequestInvitationCodeFormModal from "./requestInvitationCodeFormModal/RequestInvitationCodeFormModal";
import { InvitationType } from "src/auth/services/invitationsService/invitations.types";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";

interface Props {
  invitationCodeType: InvitationType;
  notifyOnModalOpened?: () => void;
}

const uniqueId = "7ce9ba1f-bde0-48e2-88df-e4f697945cc4";

export const DATA_TEST_ID = {
  REQUEST_INVITATION_CODE_LINK: `request-invitation-code-link-${uniqueId}`,
};
export const UI_TEXT = {
  REQUEST_LOGIN_CODE: "Don't have a login code?",
  REQUEST_REGISTRATION_CODE: "Don't have a registration code?",
  REQUEST_INVITATION_CODE_LINK: "Reach out",
};
const RequestInvitationCode = ({ invitationCodeType, notifyOnModalOpened }: Props) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isOnline = useContext(IsOnlineContext);

  if (!Sentry.isInitialized()) {
    return null;
  }

  const handleModalOpen = () => {
    notifyOnModalOpened?.();
    setIsModalOpen(true);
  };

  return (
    <>
      <Typography variant="caption" textAlign="center" gutterBottom>
        {invitationCodeType === InvitationType.LOGIN
          ? t("auth.components.requestInvitationCode.requestLoginCode")
          : t("auth.components.registrationCodeFormModal.noRegistrationCodePrompt")}
        &nbsp;
        <CustomLink
          disabled={!isOnline}
          onClick={handleModalOpen}
          data-testid={`${DATA_TEST_ID.REQUEST_INVITATION_CODE_LINK}`}
        >
          {t("auth.components.registrationCodeFormModal.reachOut")}
        </CustomLink>
      </Typography>

      <RequestInvitationCodeFormModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default RequestInvitationCode;
