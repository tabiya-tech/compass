import * as Sentry from "@sentry/react";
import { InvitationCodeRequestData } from "./RequestInvitationCode.types";
import { InvitationError } from "../../../../error/commonErrors";

export function requestInvitationCode(data: InvitationCodeRequestData) {
  // we currently use sentry to capture user feedback
  try {
    Sentry.captureFeedback({
      name: data.name,
      email: data.email,
      message: `A user has requested an invitation code. Additional information: ${data.message}`,
    });
  } catch (e) {
    throw new InvitationError(`Something went wrong while attempting to request new invitation for user with email ${data.email}`, e as Error);
  }
}