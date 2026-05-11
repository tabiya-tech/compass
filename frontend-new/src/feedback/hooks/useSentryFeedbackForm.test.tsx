import "src/_test_utilities/consoleMock";
import "src/_test_utilities/sentryMock";

import { act, renderHook, waitFor } from "src/_test_utilities/test-utils";
import { useSentryFeedbackForm } from "./useSentryFeedbackForm";
import * as Sentry from "@sentry/react";
import authenticationStateService from "src/auth/services/AuthenticationState.service";
import { PersistentStorageService } from "src/app/PersistentStorageService/PersistentStorageService";

jest.mock("src/app/PersistentStorageService/PersistentStorageService");

jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      enqueueSnackbar: jest.fn(),
      closeSnackbar: jest.fn(),
    }),
  };
});

describe("useSentryFeedbackForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Sentry.isInitialized as jest.Mock).mockReturnValue(false);
  });

  describe("sentryEnabled", () => {
    test("should return sentryEnabled false when Sentry is not initialized", async () => {
      (Sentry.isInitialized as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useSentryFeedbackForm());

      await waitFor(() => {
        expect(result.current.sentryEnabled).toBe(false);
      });
    });

    test("should return sentryEnabled true when Sentry is initialized", async () => {
      (Sentry.isInitialized as jest.Mock).mockReturnValue(true);

      const { result } = renderHook(() => useSentryFeedbackForm());

      await waitFor(() => {
        expect(result.current.sentryEnabled).toBe(true);
      });
    });
  });

  describe("openFeedbackForm", () => {
    test("should return false and not call Sentry when Sentry is not initialized", async () => {
      (Sentry.isInitialized as jest.Mock).mockReturnValue(false);
      const { result } = renderHook(() => useSentryFeedbackForm());
      await waitFor(() => expect(result.current.sentryEnabled).toBe(false));

      let opened: boolean = true;
      await act(async () => {
        opened = await result.current.openFeedbackForm();
      });

      expect(opened).toBe(false);
      expect(Sentry.captureFeedback).not.toHaveBeenCalled();
    });

    test("should return true when Sentry is initialized", async () => {
      (Sentry.isInitialized as jest.Mock).mockReturnValue(true);
      const { result } = renderHook(() => useSentryFeedbackForm());
      await waitFor(() => expect(result.current.sentryEnabled).toBe(true));

      let opened: boolean = false;
      await act(async () => {
        opened = await result.current.openFeedbackForm();
      });

      expect(opened).toBe(true);
    });

    test("should call setSeenFeedbackNotification when markNotificationSeen is true and user exists", async () => {
      (Sentry.isInitialized as jest.Mock).mockReturnValue(true);
      const givenUserId = "user-123";
      jest.spyOn(authenticationStateService.getInstance(), "getUser").mockReturnValue({
        id: givenUserId,
        name: "Test",
        email: "test@test.com",
      } as unknown as ReturnType<ReturnType<typeof authenticationStateService.getInstance>["getUser"]>);
      const { result } = renderHook(() => useSentryFeedbackForm());
      await waitFor(() => expect(result.current.sentryEnabled).toBe(true));

      await act(async () => {
        await result.current.openFeedbackForm({ markNotificationSeen: true });
      });

      expect(PersistentStorageService.setSeenFeedbackNotification).toHaveBeenCalledWith(givenUserId);
    });

    test("should expose a feedbackModalElement", async () => {
      (Sentry.isInitialized as jest.Mock).mockReturnValue(true);
      const { result } = renderHook(() => useSentryFeedbackForm());
      await waitFor(() => expect(result.current.sentryEnabled).toBe(true));

      expect(result.current.feedbackModalElement).toBeDefined();
    });
  });
});
