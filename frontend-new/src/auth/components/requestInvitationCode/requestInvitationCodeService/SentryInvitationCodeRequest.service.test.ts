import "src/_test_utilities/sentryMock";

import * as Sentry from "@sentry/react";
import { requestInvitationCode } from "./SentryInvitationCodeRequest.service";
import { RequestInvitationCodeError } from "src/error/commonErrors";

describe("requestInvitationCode", () => {
  beforeEach(() => {
    // GIVEN a fresh mock state
    jest.clearAllMocks();
  });

  it("should send feedback to Sentry with the correct data", async () => {
    // GIVEN the request data
    const requestData = {
      name: "John Doe",
      email: "john@example.com",
      message: "I want to try Compass",
    };

    // WHEN requesting an invitation code
    requestInvitationCode(requestData);

    // THEN expect Sentry.captureFeedback to be called with the correct data
    expect(Sentry.captureFeedback).toHaveBeenCalledWith(
      {
        name: requestData.name,
        email: requestData.email,
        message: `A user has requested an invitation code. Additional information: ${requestData.message}`,
        tags: {
          source: "Request Invitation Code Form",
          name: requestData.name,
        },
      },
      { includeReplay: false }
    );
  });

  it("should throw an error if Sentry.captureFeedback fails", async () => {
    // GIVEN Sentry will throw an error
    const error = new Error("Sentry error");
    (Sentry.captureFeedback as jest.Mock).mockImplementation(() => {
      throw error;
    });

    // GIVEN the request data
    const requestData = {
      name: "John Doe",
      email: "john@example.com",
      message: "I want to try Compass",
    };

    // WHEN requesting an invitation code AND it fails
    // THEN expect the error to be thrown
    expect(() => requestInvitationCode(requestData)).toThrow(
      new RequestInvitationCodeError(
        `Something went wrong while attempting to request new invitation for user with email ${requestData.email}`
      )
    );
  });
});
