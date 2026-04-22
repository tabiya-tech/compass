import * as Sentry from "@sentry/react";
import ErrorConstants from "src/error/restAPIError/RestAPIError.constants";
import { FirebaseErrorCodes } from "src/error/FirebaseError/firebaseError.constants";
import { FirebaseError } from "src/error/FirebaseError/firebaseError";
import { RestAPIError } from "src/error/restAPIError/RestAPIError";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { buildSupportReference, copyToClipboard } from "src/error/supportReference/supportReference";

jest.mock("@sentry/react", () => ({
  lastEventId: jest.fn(),
}));

describe("Test buildSupportReference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(UserPreferencesStateService.getInstance(), "getActiveSessionId").mockReturnValue(42);
  });

  test("includes correlation id and sentry id from a RestAPIError response body", () => {
    // GIVEN a RestAPIError parsed from a backend response that carried reference fields
    const givenCauseJson = JSON.stringify({
      detail: "server exploded",
      correlation_id: "corr-xyz",
      sentry_event_id: "ev-backend",
    });
    const givenError = new RestAPIError(
      "SomeService",
      "doThing",
      "POST",
      "/api/thing",
      500,
      ErrorConstants.ErrorCodes.API_ERROR,
      "server exploded",
      givenCauseJson
    );

    // WHEN building a support reference for it
    const actualReference = buildSupportReference({
      error: givenError,
      where: "Chat conversation (send)",
      displayMessage: "Display text",
    });

    // THEN the copy payload lists the backend reference and sentry id
    expect(actualReference.copyPayload).toContain("Reference: corr-xyz");
    expect(actualReference.copyPayload).toContain("Sentry: ev-backend");
    // AND describes what and where
    expect(actualReference.copyPayload).toContain("Where: Chat conversation (send)");
    expect(actualReference.copyPayload).toContain("500");
    // AND includes the active session id
    expect(actualReference.copyPayload).toContain("Session: 42");
    // AND the display text is the one provided
    expect(actualReference.displayText).toBe("Display text");
  });

  test("falls back to Sentry.lastEventId when the error is not a RestAPIError", () => {
    // GIVEN Sentry currently has a last event id and the error is not a REST error
    (Sentry.lastEventId as jest.Mock).mockReturnValue("ev-fe");
    const givenError = new Error("whoops");

    // WHEN building a support reference
    const actualReference = buildSupportReference({
      error: givenError,
      where: "Login",
      displayMessage: "Display text",
    });

    // THEN the copy payload lists the Sentry id and omits backend correlation id
    expect(actualReference.copyPayload).toContain("Sentry: ev-fe");
    expect(actualReference.copyPayload).not.toContain("Reference:");
  });

  test("describes a FirebaseError by its error code", () => {
    // GIVEN a FirebaseError with a known code
    const givenError = new FirebaseError("AuthService", "login", FirebaseErrorCodes.INVALID_EMAIL, "nope");

    // WHEN building a support reference
    const actualReference = buildSupportReference({
      error: givenError,
      where: "Login",
      displayMessage: "Display text",
    });

    // THEN the error line identifies the Firebase code
    expect(actualReference.copyPayload).toContain(`Firebase ${FirebaseErrorCodes.INVALID_EMAIL}`);
  });

  test("omits the session line when no active session exists", () => {
    // GIVEN no active session
    jest.spyOn(UserPreferencesStateService.getInstance(), "getActiveSessionId").mockReturnValue(null);

    // WHEN building a support reference
    const actualReference = buildSupportReference({
      error: new Error("x"),
      where: "Anywhere",
      displayMessage: "Display text",
    });

    // THEN the session line is absent
    expect(actualReference.copyPayload).not.toContain("Session:");
  });

  test("includes the current ISO timestamp", () => {
    // GIVEN the builder is invoked
    const actualReference = buildSupportReference({
      error: new Error("x"),
      where: "Anywhere",
      displayMessage: "Display text",
    });

    // THEN a Time line with an ISO-8601 timestamp is present
    expect(actualReference.copyPayload).toMatch(/^Time: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*$/m);
  });
});

describe("Test copyToClipboard", () => {
  test("returns true when navigator.clipboard.writeText resolves", async () => {
    // GIVEN navigator.clipboard.writeText is available and succeeds
    const mockedWriteText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockedWriteText },
    });

    // WHEN copyToClipboard is called
    const actualResult = await copyToClipboard("hello");

    // THEN it resolves true and writeText was invoked with the payload
    expect(actualResult).toBe(true);
    expect(mockedWriteText).toHaveBeenCalledWith("hello");
  });
});
