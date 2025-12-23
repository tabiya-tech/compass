// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, act, waitFor, userEvent } from "src/_test_utilities/test-utils";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { DislikeReaction, DislikeReason, LikeReaction, ReactionKind } from "src/chat/reaction/reaction.types";
import { ReactionService } from "src/chat/reaction/services/reactionService/reaction.service";
import ReactionButtons, { DATA_TEST_ID } from "src/chat/reaction/components/reactionButtons/ReactionButtons";
import DislikeReasonPopover, {
  DATA_TEST_ID as REACTION_REASON_POPOVER_DATA_TEST_ID,
} from "src/chat/reaction/components/dislikeReasonPopover/DislikeReasonPopover";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { ReactionError } from "src/error/commonErrors";
import { UserPreference } from "src/userPreferences/UserPreferencesService/userPreferences.types";

// mock the ReactionReasonPopover
jest.mock("src/chat/reaction/components/dislikeReasonPopover/DislikeReasonPopover", () => {
  const actual = jest.requireActual("src/chat/reaction/components/dislikeReasonPopover/DislikeReasonPopover");
  return {
    __esModule: true,
    ...actual,
    default: jest.fn(() => <div data-testid={actual.DATA_TEST_ID.CONTAINER} />),
  };
});

// mock the reaction service
jest.mock("src/chat/reaction/services/reactionService/reaction.service");

// mock the snackbar provider
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

describe("ReactionButtons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowserIsOnLine(true);
  });

  describe("render tests", () => {
    test("should render correctly when no reaction is selected initially", () => {
      // GIVEN a message id and no initial reaction
      const givenMessageId = "123";
      const givenSessionId = 234;
      const givenCurrentReaction = null;

      UserPreferencesStateService.getInstance().setUserPreferences({
        sessions: [givenSessionId],
      } as unknown as UserPreference);

      // WHEN the component is rendered
      render(<ReactionButtons messageId={givenMessageId} currentReaction={givenCurrentReaction} />);

      // THEN expect neither the like nor the dislike button to be active
      expect(screen.getByTestId(DATA_TEST_ID.ICON_LIKE_DEFAULT)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.ICON_DISLIKE_DEFAULT)).toBeInTheDocument();

      // AND expect the component to match the snapshot
      expect(screen.getByTestId(DATA_TEST_ID.CONTAINER)).toMatchSnapshot();
      // THEN expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      [
        {
          id: "456",
          kind: ReactionKind.LIKED,
        },
        DATA_TEST_ID.BUTTON_LIKE,
      ],
      [
        {
          id: "456",
          kind: ReactionKind.DISLIKED,
        },
        DATA_TEST_ID.BUTTON_DISLIKE,
      ],
    ])("should render the reaction buttons and show the correct reaction icon for %s", (reaction, iconTestId) => {
      // GIVEN a message id and sessionId
      const givenMessageId = "123";
      const givenSessionId = 234;
      UserPreferencesStateService.getInstance().setUserPreferences({
        sessions: [givenSessionId],
      } as unknown as UserPreference);

      // WHEN the component is rendered
      render(<ReactionButtons messageId={givenMessageId} currentReaction={reaction} />);

      // THEN expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      // AND expect the container to be in the document
      const container = screen.getByTestId(DATA_TEST_ID.CONTAINER);
      expect(container).toBeInTheDocument();
      // AND expect both like and dislike buttons to be rendered
      expect(screen.getByTestId(DATA_TEST_ID.BUTTON_LIKE)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.BUTTON_DISLIKE)).toBeInTheDocument();
      // AND expect the correct button to be active
      expect(screen.getByTestId(iconTestId)).toBeInTheDocument();
      // AND expect the component to match snapshot
      expect(container).toMatchSnapshot();
      // THEN expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should render the reaction buttons as disabled when the browser is offline", () => {
      // GIVEN a message id and sessionId
      const givenMessageId = "123";
      const givenSessionId = 234;
      UserPreferencesStateService.getInstance().setUserPreferences({
        sessions: [givenSessionId],
      } as unknown as UserPreference);

      // AND the browser is offline
      mockBrowserIsOnLine(false);

      // WHEN the component is rendered
      render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

      // THEN expect the container to be in the document
      const container = screen.getByTestId(DATA_TEST_ID.CONTAINER);
      expect(container).toBeInTheDocument();
      // AND expect both like and dislike buttons to be rendered
      const likeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_LIKE);
      expect(likeButton).toBeInTheDocument();
      const dislikeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_DISLIKE);
      expect(dislikeButton).toBeInTheDocument();
      // AND expect both buttons to be disabled
      expect(likeButton).toBeDisabled();
      expect(dislikeButton).toBeDisabled();
      // AND expect the component to match snapshot
      expect(container).toMatchSnapshot();
      // THEN expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("shold throw an error if there is no session", () => {
      // GIVEN no session id
      const givenMessageId = "123";
      const givenSessionId = null;
      UserPreferencesStateService.getInstance().setUserPreferences({
        sessions: [givenSessionId],
      } as unknown as UserPreference);

      // WHEN the component is rendered
      // THEN expect an error to be thrown
      expect(() => render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />)).toThrow(
        ReactionError
      );
    });
  });

  describe("action tests", () => {
    describe("dislike reaction", () => {
      test("should call the ReactionReasonPopover with the correct parameters", async () => {
        // GIVEN the component is rendered with no initial reaction
        const givenMessageId = "123";
        const givenSessionId = 234;
        UserPreferencesStateService.getInstance().setUserPreferences({
          sessions: [givenSessionId],
        } as unknown as UserPreference);

        render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

        // WHEN the dislike button is clicked
        const dislikeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_DISLIKE);
        await userEvent.click(dislikeButton);

        // THEN expect the ReactionReasonPopover component to be displayed with correct parameters
        await waitFor(() => {
          expect(DislikeReasonPopover).toHaveBeenLastCalledWith(
            expect.objectContaining({
              anchorEl: dislikeButton,
              open: true,
              onClose: expect.any(Function),
            }),
            {}
          );
        });

        // AND expect the popover container to be in the document
        expect(screen.getByTestId(REACTION_REASON_POPOVER_DATA_TEST_ID.CONTAINER)).toBeInTheDocument();
      });

      test("should call the onReactionChange function when a dislike reason is selected in the popover", async () => {
        // GIVEN a message id, session id, and onReactionChange function
        const givenMessageId = "123";
        const givenSessionId = 234;
        UserPreferencesStateService.getInstance().setUserPreferences({
          sessions: [givenSessionId],
        } as unknown as UserPreference);

        const givenReason = DislikeReason.CONFUSING;
        // AND a mocked service
        const sendSpy = jest.spyOn(ReactionService.prototype, "sendReaction").mockResolvedValueOnce();
        // AND the component is rendered
        render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

        // WHEN the dislike button is clicked
        const dislikeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_DISLIKE);
        await userEvent.click(dislikeButton);

        // AND a reason is selected in the popover
        await act(async () => {
          (DislikeReasonPopover as jest.Mock).mock.calls.at(-1)[0].onClose([givenReason]);
        });

        // THEN expect the service to be called with the dislike reason
        await waitFor(() => {
          expect(sendSpy).toHaveBeenCalledWith(givenSessionId, givenMessageId, new DislikeReaction([givenReason]));
        });
        // THEN expect no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should handle a failed reaction submission when a dislike reason is selected in the popover", async () => {
        // GIVEN onReactionChange function
        const givenMessageId = "1234";
        const givenSessionId = 234;
        UserPreferencesStateService.getInstance().setUserPreferences({
          sessions: [givenSessionId],
        } as unknown as UserPreference);

        const givenReason = DislikeReason.BIASED;
        // AND a mocked service that rejects
        const givenError = new Error("Failed to submit reaction");
        const sendSpy = jest.spyOn(ReactionService.prototype, "sendReaction").mockRejectedValueOnce(givenError);

        // AND the component is rendered
        render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

        // WHEN the dislike button is clicked
        const dislikeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_DISLIKE);
        await userEvent.click(dislikeButton);
        // AND a reason is selected in the popover
        act(() => {
          (DislikeReasonPopover as jest.Mock).mock.calls.at(-1)[0].onClose([givenReason]);
        });

        // THEN expect the service to be called with the dislike reason
        expect(sendSpy).toHaveBeenCalledWith(givenSessionId, givenMessageId, new DislikeReaction([givenReason]));

        // AND expect an error to be logged
        await waitFor(() => {
          expect(console.error).toHaveBeenCalledWith(
            new Error("Failed to submit the dislike feedback", { cause: expect.any(Error) })
          );
        });
        // AND expect an error snackbar to be shown
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to submit the feedback. Please try again.", {
          variant: "error",
        });
      });

      test("should rollback to the previous reaction if the service request fails for dislike reaction", async () => {
        // GIVEN a message ID, session ID, and an initial reaction
        const givenMessageId = "123";
        const givenSessionId = 234;
        UserPreferencesStateService.getInstance().setUserPreferences({
          sessions: [givenSessionId],
        } as unknown as UserPreference);

        // AND the service fails for the new reaction
        const givenPreviousReaction = {
          id: "456",
          kind: ReactionKind.LIKED,
        };
        let rejectSendReaction: (value: any) => void = () => {};
        const sendSpy = jest.spyOn(ReactionService.prototype, "sendReaction").mockReturnValueOnce(
          new Promise((_resolve, reject) => {
            rejectSendReaction = reject;
          })
        );

        // AND the component is rendered with the initial reaction
        render(<ReactionButtons messageId={givenMessageId} currentReaction={givenPreviousReaction} />);

        // WHEN the dislike button is clicked
        const dislikeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_DISLIKE);
        await userEvent.click(dislikeButton);
        // AND a reason is selected in the popover
        const givenReason = DislikeReason.BIASED;
        act(() => {
          (DislikeReasonPopover as jest.Mock).mock.calls.at(-1)[0].onClose([givenReason]);
        });

        // THEN expect the dislike active icon to be displayed
        await waitFor(() => {
          expect(screen.getByTestId(DATA_TEST_ID.ICON_DISLIKE_ACTIVE)).toBeInTheDocument();
        });
        // AND the service to be called with the dislike reaction
        expect(sendSpy).toHaveBeenCalledWith(
          givenSessionId,
          givenMessageId,
          new DislikeReaction([givenReason as unknown as DislikeReason])
        );

        // WHEN the service request fails
        await act(async () => {
          rejectSendReaction(new Error("Failed to submit dislike reaction"));
        });

        // THEN expect the reaction to roll back to the previous reaction
        await waitFor(() => {
          expect(screen.getByTestId(DATA_TEST_ID.ICON_LIKE_ACTIVE)).toBeInTheDocument();
        });
        // AND expect the snackbar to show an error message
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to submit the feedback. Please try again.", {
          variant: "error",
        });
      });

      test("should not allow sending a dislike request if another request is already in progress", async () => {
        // GIVEN a message ID, session ID, and an initial reaction
        const givenMessageId = "123";
        const givenSessionId = 234;
        UserPreferencesStateService.getInstance().setUserPreferences({
          sessions: [givenSessionId],
        } as unknown as UserPreference);

        // AND the service has a pending request that doesn't resolve
        let resolveSendReaction: (value: any) => void = () => {};
        const sendSpy = jest.spyOn(ReactionService.prototype, "sendReaction").mockReturnValue(
          new Promise((resolve) => {
            resolveSendReaction = resolve;
          })
        );

        // AND the component is rendered
        render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

        // WHEN the dislike button is clicked
        const dislikeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_DISLIKE);
        await userEvent.click(dislikeButton);

        // AND a reason is selected in the popover
        const givenReason = DislikeReason.BIASED;
        act(() => {
          (DislikeReasonPopover as jest.Mock).mock.calls.at(-1)[0].onClose([givenReason]);
        });

        // THEN expect the service to be called once with the dislike reaction
        expect(sendSpy).toHaveBeenCalledTimes(1);
        expect(sendSpy).toHaveBeenCalledWith(givenSessionId, givenMessageId, new DislikeReaction([givenReason]));

        // WHEN trying to send another dislike reaction while the first is pending by force clicking
        await userEvent.click(dislikeButton, { pointerEventsCheck: 0 });

        // THEN expect the popover not to open again
        expect(DislikeReasonPopover).toHaveBeenLastCalledWith(
          expect.objectContaining({
            anchorEl: null,
            open: false,
          }),
          {}
        );

        // WHEN the first request finally resolves
        act(() => {
          resolveSendReaction(undefined);
        });

        // THEN expect no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe("like reaction", () => {
      test("should call the onReactionChange function with the correct reaction when the like button is clicked", async () => {
        // GIVEN a message id , session id and onReactionChange function
        const givenMessageId = "123";
        const givenSessionId = 234;
        UserPreferencesStateService.getInstance().setUserPreferences({
          sessions: [givenSessionId],
        } as unknown as UserPreference);

        // AND the reaction will be sent successfully
        const sendSpy = jest.spyOn(ReactionService.prototype, "sendReaction").mockResolvedValueOnce();
        // AND the component is rendered
        render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

        // WHEN the like button is clicked
        const likeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_LIKE);
        await userEvent.click(likeButton);

        // THEN expect to update the reaction to LIKE
        expect(screen.getByTestId(DATA_TEST_ID.ICON_LIKE_ACTIVE)).toBeInTheDocument();
        // AND the service to be called with the correct reaction (LIKE)
        expect(sendSpy).toHaveBeenCalledWith(givenSessionId, givenMessageId, new LikeReaction());

        // THEN expect no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should disable interactions while a like request is in progress", async () => {
        // GIVEN a message ID, session ID, and an initial reaction
        const givenMessageId = "123";
        const givenSessionId = 234;
        UserPreferencesStateService.getInstance().setUserPreferences({
          sessions: [givenSessionId],
        } as unknown as UserPreference);

        // AND the service has a pending request that doesn't resolve
        let resolveSendReaction: (value: any) => void = () => {};
        const sendSpy = jest.spyOn(ReactionService.prototype, "sendReaction").mockReturnValue(
          new Promise((resolve) => {
            resolveSendReaction = resolve;
          })
        );

        // AND the component is rendered
        render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

        // WHEN the like button is clicked
        const likeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_LIKE);
        await userEvent.click(likeButton);

        // THEN expect the service to be called once with the like reaction
        expect(sendSpy).toHaveBeenCalledTimes(1);
        expect(sendSpy).toHaveBeenCalledWith(givenSessionId, givenMessageId, new LikeReaction());

        // AND expect both buttons to be disabled while request is pending
        expect(screen.getByTestId(DATA_TEST_ID.BUTTON_LIKE)).toBeDisabled();
        expect(screen.getByTestId(DATA_TEST_ID.BUTTON_DISLIKE)).toBeDisabled();

        // WHEN the first request finally resolves
        act(() => {
          resolveSendReaction(undefined);
        });

        // THEN expect the buttons to be enabled again
        await waitFor(() => {
          expect(screen.getByTestId(DATA_TEST_ID.BUTTON_LIKE)).not.toBeDisabled();
        });
        expect(screen.getByTestId(DATA_TEST_ID.BUTTON_DISLIKE)).not.toBeDisabled();

        // AND expect no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should not allow sending a like request if another request is already in progress", async () => {
        // GIVEN a message ID, session ID, and an initial reaction
        const givenMessageId = "123";
        const givenSessionId = 234;
        UserPreferencesStateService.getInstance().setUserPreferences({
          sessions: [givenSessionId],
        } as unknown as UserPreference);

        // AND the service has a pending request that doesn't resolve
        let resolveSendReaction: (value: any) => void = () => {};
        const sendSpy = jest.spyOn(ReactionService.prototype, "sendReaction").mockReturnValue(
          new Promise((resolve) => {
            resolveSendReaction = resolve;
          })
        );

        // AND the component is rendered
        render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

        // WHEN the like button is clicked
        const likeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_LIKE);
        await userEvent.click(likeButton);

        // THEN expect the service to be called once with the like reaction
        expect(sendSpy).toHaveBeenCalledTimes(1);
        expect(sendSpy).toHaveBeenCalledWith(givenSessionId, givenMessageId, new LikeReaction());

        // WHEN trying to send another like reaction while the first is pending by force clicking
        await userEvent.click(likeButton, { pointerEventsCheck: 0 });

        // THEN expect the service to still only have been called once
        expect(sendSpy).toHaveBeenCalledTimes(1);

        // WHEN the first request finally resolves
        act(() => {
          resolveSendReaction(undefined);
        });

        // THEN expect no errors or warnings to have occurred
        expect(console.error).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
      });

      test("should handle a failed reaction submission when the like button is clicked", async () => {
        // GIVEN a message ID, session ID, and onReactionChange function
        const givenMessageId = "123";
        const givenSessionId = 234;
        UserPreferencesStateService.getInstance().setUserPreferences({
          sessions: [givenSessionId],
        } as unknown as UserPreference);

        // AND a mocked service that rejects
        const givenError = new Error("Failed to submit reaction");
        const sendSpy = jest.spyOn(ReactionService.prototype, "sendReaction").mockRejectedValueOnce(givenError);
        // AND the component is rendered
        render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

        // WHEN the like button is clicked
        const likeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_LIKE);
        await userEvent.click(likeButton);

        // THEN expect the service to be called with the LIKE reaction
        expect(sendSpy).toHaveBeenCalledWith(givenSessionId, givenMessageId, new LikeReaction());

        // AND expect an error snackbar to be displayed
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to submit the feedback. Please try again.", {
          variant: "error",
        });
        // AND expect an error to be logged
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith(
          new Error("Failed to submit the like feedback", { cause: givenError })
        );
      });

      test("should rollback to the previous reaction if the service request fails for like reaction", async () => {
        // GIVEN a message ID, session ID, and an initial reaction
        const givenMessageId = "123";
        const givenSessionId = 234;
        UserPreferencesStateService.getInstance().setUserPreferences({
          sessions: [givenSessionId],
        } as unknown as UserPreference);

        const givenPreviousReaction = {
          id: "456",
          kind: ReactionKind.DISLIKED,
        };
        // AND the service fails for the new reaction
        let rejectSendReaction: (value: any) => void = () => {};
        const sendSpy = jest.spyOn(ReactionService.prototype, "sendReaction").mockReturnValueOnce(
          new Promise((_resolve, reject) => {
            rejectSendReaction = reject;
          })
        );

        // AND the component is rendered with the initial reaction
        render(<ReactionButtons messageId={givenMessageId} currentReaction={givenPreviousReaction} />);

        // WHEN the like button is clicked
        const likeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_LIKE);
        await userEvent.click(likeButton);

        // THEN expect the like active icon to be displayed
        await waitFor(() => {
          expect(screen.getByTestId(DATA_TEST_ID.ICON_LIKE_ACTIVE)).toBeInTheDocument();
        });
        // AND the service to be called with the like reaction
        expect(sendSpy).toHaveBeenCalledWith(givenSessionId, givenMessageId, new LikeReaction());

        // WHEN the service request fails
        await act(async () => {
          rejectSendReaction(new Error("Failed to submit like reaction"));
        });

        // THEN expect the reaction to roll back to the previous reaction
        await waitFor(() => {
          expect(screen.getByTestId(DATA_TEST_ID.ICON_DISLIKE_ACTIVE)).toBeInTheDocument();
        });
        // AND expect the snackbar to show an error message
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to submit the feedback. Please try again.", {
          variant: "error",
        });
      });
    });

    test.each([
      ["liked", ReactionKind.LIKED, DATA_TEST_ID.BUTTON_LIKE, DATA_TEST_ID.ICON_LIKE_ACTIVE],
      ["disliked", ReactionKind.DISLIKED, DATA_TEST_ID.BUTTON_DISLIKE, DATA_TEST_ID.ICON_DISLIKE_ACTIVE],
    ])("should handle %s reaction removal successfully", async (_description, reaction, buttonTestId, iconTestId) => {
      // GIVEN a message ID, session ID, and onReactionChange function
      const givenMessageId = "123";
      const givenSessionId = 234;
      const givenCurrentReaction = {
        id: "456",
        kind: reaction,
      };
      UserPreferencesStateService.getInstance().setUserPreferences({
        sessions: [givenSessionId],
      } as unknown as UserPreference);

      // AND a mocked service that resolves
      const deleteSpy = jest.spyOn(ReactionService.prototype, "deleteReaction").mockResolvedValueOnce();

      // AND the component is rendered with the current reaction
      render(<ReactionButtons messageId={givenMessageId} currentReaction={givenCurrentReaction} />);

      // WHEN the reaction button is clicked to remove the reaction
      const button = screen.getByTestId(buttonTestId);
      await userEvent.click(button);

      // THEN expect the service to be called
      expect(deleteSpy).toHaveBeenCalledWith(givenSessionId, givenMessageId);
      // AND the existing reaction to have been removed
      expect(screen.queryByTestId(iconTestId)).not.toBeInTheDocument();
      // THEN expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    test.each([
      ["liked", ReactionKind.LIKED, DATA_TEST_ID.BUTTON_LIKE],
      ["disliked", ReactionKind.DISLIKED, DATA_TEST_ID.BUTTON_DISLIKE],
    ])("should handle %s reaction removal failure", async (_description, reaction, buttonTestId) => {
      // GIVEN a message ID, session ID, and onReactionChange function
      const givenMessageId = "123";
      const givenSessionId = 234;
      const givenCurrentReaction = {
        id: "456",
        kind: reaction,
      };
      UserPreferencesStateService.getInstance().setUserPreferences({
        sessions: [givenSessionId],
      } as unknown as UserPreference);

      // AND a mocked service that rejects
      jest
        .spyOn(ReactionService.prototype, "deleteReaction")
        .mockRejectedValueOnce(new Error("Failed to remove reaction"));

      // AND the component is rendered with the current reaction
      render(<ReactionButtons messageId={givenMessageId} currentReaction={givenCurrentReaction} />);

      // WHEN the reaction button is clicked to remove the reaction
      const button = screen.getByTestId(buttonTestId);
      await userEvent.click(button);

      // THEN expect an error snackbar to be displayed
      await waitFor(() => {
        expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to remove the feedback. Please try again.", {
          variant: "error",
        });
      });
    });
  });
});
