import * as Sentry from "@sentry/react";
import { InvitationCodeRequestData } from "./RequestInvitationCode.types";
import { RequestInvitationCodeError } from "src/error/commonErrors";

export function requestInvitationCode(data: InvitationCodeRequestData) {
  // we currently use sentry to capture user feedback
  try {
    Sentry.captureFeedback(
      {
        name: data.name,
        email: data.email,
        message: `A user has requested an invitation code. Additional information: ${data.message}`,
        tags: {
          source: "Request Invitation Code Form",
          name: data.name,
        },
      },
      {
        includeReplay: false,
      }
    );
  } catch (e) {
    throw new RequestInvitationCodeError(
      `Something went wrong while attempting to request new invitation for user with email ${data.email}`,
      e
    );
  }
}
