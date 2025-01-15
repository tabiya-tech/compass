// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen, act, waitFor } from "src/_test_utilities/test-utils";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { ReactionType } from "src/feedback/reaction/reaction.types";
import { ReactionService } from "src/feedback/reaction/services/reactionService/reaction.service";
import userEvent from "@testing-library/user-event";
import ReactionButtons, { DATA_TEST_ID } from "src/feedback/reaction/components/reactionButtons/ReactionButtons";
import ReactionReasonPopover, {
  DATA_TEST_ID as REACTION_REASON_POPOVER_DATA_TEST_ID,
} from "src/feedback/reaction/components/reactionReasonPopover/ReactionReasonPopover";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";

// mock the ReactionReasonPopover
jest.mock("src/feedback/reaction/components/reactionReasonPopover/ReactionReasonPopover", () => {
  const actual = jest.requireActual("src/feedback/reaction/components/reactionReasonPopover/ReactionReasonPopover");
  return {
    __esModule: true,
    ...actual,
    default: jest.fn(({ onReasonSelect }: { onReasonSelect: (reason: string) => void }) => (
      <div data-testid={actual.DATA_TEST_ID.CONTAINER} />
    )),
  };
});

// mock the reaction service
jest.mock("src/feedback/reaction/services/reactionService/reaction.service");

// mock the user preferences state service
jest.mock("src/userPreferences/UserPreferencesStateService");

// mock the snackbar provider
jest.mock("src/theme/SnackbarProvider/SnackbarProvider", () => {
  const actual = jest.requireActual("src/theme/SnackbarProvider/SnackbarProvider");
  return {
    ...actual,
    __esModule: true,
    useSnackbar: jest.fn().mockReturnValue({
      enqueueSnackbar: jest.fn(),
    }),
  };
});

describe("ReactionButtons", () => {
  // UserPreferencesStateService methods to be mocked
  const mockGetActiveSessionId = jest.fn();
  const mockActiveSessionHasFeedback = jest.fn();
  const mockSetUserPreferences = jest.fn();

  beforeEach(() => {
    // Mock the static getInstance method to return an instance with mocked methods
    jest.spyOn(UserPreferencesStateService, "getInstance").mockReturnValue({
      getActiveSessionId: mockGetActiveSessionId,
      activeSessionHasFeedback: mockActiveSessionHasFeedback,
      setUserPreferences: mockSetUserPreferences,
    } as unknown as UserPreferencesStateService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe("render tests", () => {
    test("should render correctly when no reaction is selected initially", () => {
      // GIVEN a message id and no initial reaction
      const givenMessageId = "123";
      const givenSessionId = 234;
      const givenCurrentReaction = null;

      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // WHEN the component is rendered
      render(<ReactionButtons messageId={givenMessageId} currentReaction={givenCurrentReaction} />);

      // THEN expect neither the like nor the dislike button to be active
      expect(screen.getByTestId(DATA_TEST_ID.ICON_LIKE_DEFAULT)).toBeInTheDocument();
      expect(screen.getByTestId(DATA_TEST_ID.ICON_DISLIKE_DEFAULT)).toBeInTheDocument();
    });

    test.each([
      [
        {
          id: "456",
          kind: ReactionType.LIKED,
        },
        DATA_TEST_ID.BUTTON_LIKE,
      ],
      [
        {
          id: "456",
          kind: ReactionType.DISLIKED,
        },
        DATA_TEST_ID.BUTTON_DISLIKE,
      ],
    ])("should render the reaction buttons and show the correct reaction icon for %s", (reaction, iconTestId) => {
      // GIVEN a message id and sessionId
      const givenMessageId = "123";
      const givenSessionId = 234;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

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
    });

    test("should call the ReactionReasonPopover with the correct parameters", async () => {
      // GIVEN the component is rendered
      const givenMessageId = "123";
      const givenSessionId = 234;
      const givenCurrentReaction = {
        id: "456",
        kind: ReactionType.LIKED,
      };
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      render(<ReactionButtons messageId={givenMessageId} currentReaction={givenCurrentReaction} />);

      // WHEN the dislike button is clicked
      const dislikeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_DISLIKE);
      await userEvent.click(dislikeButton);

      // THEN expect the ReactionReasonPopover component to be displayed
      expect(screen.getByTestId(REACTION_REASON_POPOVER_DATA_TEST_ID.CONTAINER)).toBeInTheDocument();
      // AND to be called with the correct parameters
      expect(ReactionReasonPopover).toHaveBeenCalledWith(
        {
          open: true,
          anchorEl: expect.any(HTMLElement),
          onClose: expect.any(Function),
          onReasonSelect: expect.any(Function),
        },
        {}
      );
    });
  });

  describe("action tests", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const mockSendReaction = jest.spyOn(ReactionService.prototype, "sendReaction");
    const mockDeleteReaction = jest.spyOn(ReactionService.prototype, "deleteReaction");

    test("should call the onReactionChange function with the correct reaction when the like button is clicked", async () => {
      // GIVEN a message id , session id and onReactionChange function
      const givenMessageId = "123";
      const givenSessionId = 234;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND a mocked service
      mockSendReaction.mockResolvedValueOnce();
      // AND the component is rendered
      render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

      // WHEN the like button is clicked
      const likeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_LIKE);
      await userEvent.click(likeButton);

      // THEN expect to update the reaction to LIKE
      expect(screen.getByTestId(DATA_TEST_ID.ICON_LIKE_ACTIVE)).toBeInTheDocument();
      // AND the service to be called with the correct reaction (LIKE)
      expect(mockSendReaction).toHaveBeenCalledWith(givenSessionId, givenMessageId, {
        kind: ReactionType.LIKED,
        reason: null,
      });

      // AND no error should be logged
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should call the onReactionChange function when a dislike reason is selected in the popover", async () => {
      // GIVEN a message id, session id, and onReactionChange function
      const givenMessageId = "123";
      const givenSessionId = 234;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      const givenReason = "Not helpful";
      // AND a mocked service
      mockSendReaction.mockResolvedValueOnce();
      // AND the component is rendered
      render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

      // WHEN the dislike button is clicked
      const dislikeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_DISLIKE);
      await userEvent.click(dislikeButton);
      // AND a reason is selected in the popover
      (ReactionReasonPopover as jest.Mock).mock.calls.at(-1)[0].onReasonSelect(givenReason);

      // THEN expect the service to be called with the dislike reason
      expect(mockSendReaction).toHaveBeenCalledWith(givenSessionId, givenMessageId, {
        kind: ReactionType.DISLIKED,
        reason: givenReason,
      });
    });

    test("should handle a failed reaction submission when the like button is clicked", async () => {
      // GIVEN a message ID, session ID, and onReactionChange function
      const givenMessageId = "123";
      const givenSessionId = 234;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND a mocked service that rejects
      mockSendReaction.mockRejectedValueOnce(new Error("Failed to submit reaction"));
      // AND the component is rendered
      render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

      // WHEN the like button is clicked
      const likeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_LIKE);
      await userEvent.click(likeButton);

      // THEN expect the service to be called with the LIKE reaction
      expect(mockSendReaction).toHaveBeenCalledWith(givenSessionId, givenMessageId, {
        kind: ReactionType.LIKED,
        reason: null,
      });

      // AND expect an error to be logged
      expect(console.error).toHaveBeenCalledWith(
        new Error("Failed to submit the like feedback", { cause: expect.any(Error) })
      );
      // AND expect an error snackbar to be displayed
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to submit the feedback. Please try again.", {
        variant: "error",
      });
    });

    test("should handle a failed reaction submission when a dislike reason is selected in the popover", async () => {
      // GIVEN onReactionChange function
      const givenMessageId = "1234";
      const givenSessionId = 234;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      const givenReason = "Not helpful";
      // AND a mocked service that rejects
      mockSendReaction.mockRejectedValueOnce(new Error("Failed to submit reaction"));

      // AND the component is rendered
      render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

      // WHEN the dislike button is clicked
      const dislikeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_DISLIKE);
      await userEvent.click(dislikeButton);
      // AND a reason is selected in the popover
      act(() => {
        (ReactionReasonPopover as jest.Mock).mock.calls.at(-1)[0].onReasonSelect(givenReason);
      });

      // THEN expect the service to be called with the dislike reason
      expect(mockSendReaction).toHaveBeenCalledWith(givenSessionId, givenMessageId, {
        kind: ReactionType.DISLIKED,
        reason: givenReason,
      });

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

    test("should show a snackbar when a request is in progress and the user clicks the like button again", async () => {
      // GIVEN a message id, session id, and onReactionChange function
      const givenMessageId = "123";
      const givenSessionId = 234;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND a mocked service that takes time to resolve
      mockSendReaction.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));
      // AND the component is rendered
      render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

      // WHEN the like button is clicked
      const likeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_LIKE);
      await userEvent.click(likeButton);
      // AND the like button is clicked again before the first request completes
      await userEvent.click(likeButton);

      // THEN expect the snackbar to be shown with the appropriate message
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Please wait, your request is being processed.", {
        variant: "warning",
      });
      // AND no additional requests should be sent
      expect(mockSendReaction).toHaveBeenCalledTimes(1);
    });

    test("should show a snackbar when a request is in progress and the dislike button is clicked again", async () => {
      // GIVEN a message ID, session ID, and onReactionChange function
      const givenMessageId = "123";
      const givenSessionId = 234;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND a mocked sendReaction service
      mockSendReaction.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));
      // AND the component is rendered
      render(<ReactionButtons messageId={givenMessageId} currentReaction={null} />);

      // WHEN the dislike button is clicked with a given reason
      const givenReason = "Not helpful";
      const dislikeButton = screen.getByTestId(DATA_TEST_ID.BUTTON_DISLIKE);
      await userEvent.click(dislikeButton);
      // AND a reason is selected in the popover
      (ReactionReasonPopover as jest.Mock).mock.calls.at(-1)[0].onReasonSelect(givenReason);

      // THEN expect the service to be called with the dislike reason
      expect(mockSendReaction).toHaveBeenCalledWith(givenSessionId, givenMessageId, {
        kind: ReactionType.DISLIKED,
        reason: "Not helpful",
      });
      // AND the dislike button is clicked again while the request is in progress
      await userEvent.click(dislikeButton);
      // AND no additional requests should be sent
      expect(mockSendReaction).toHaveBeenCalledTimes(1);
    });

    test("should rollback to the previous reaction if the service request fails for dislike reaction", async () => {
      // GIVEN a message ID, session ID, and an initial reaction
      const givenMessageId = "123";
      const givenSessionId = 234;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND the service fails for the new reaction
      const givenPreviousReaction = {
        id: "456",
        kind: ReactionType.LIKED,
      };
      let rejectSendReaction: (value: any) => void = () => {};
      mockSendReaction.mockReturnValue(
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
      const givenReason = "Not helpful";
      (ReactionReasonPopover as jest.Mock).mock.calls.at(-1)[0].onReasonSelect(givenReason);

      // THEN expect the dislike active icon to be displayed
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.ICON_DISLIKE_ACTIVE)).toBeInTheDocument();
      });
      // AND the service to be called with the dislike reaction
      expect(mockSendReaction).toHaveBeenCalledWith(givenSessionId, givenMessageId, {
        kind: ReactionType.DISLIKED,
        reason: "Not helpful",
      });

      // WHEN the service request fails
      rejectSendReaction(new Error("Failed to submit dislike reaction"));

      // THEN expect the reaction to roll back to the previous reaction
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.ICON_LIKE_ACTIVE)).toBeInTheDocument();
      });
      // AND expect the snackbar to show an error message
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to submit the feedback. Please try again.", {
        variant: "error",
      });
    });

    test("should rollback to the previous reaction if the service request fails for like reaction", async () => {
      // GIVEN a message ID, session ID, and an initial reaction
      const givenMessageId = "123";
      const givenSessionId = 234;
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      const givenPreviousReaction = {
        id: "456",
        kind: ReactionType.DISLIKED,
      };
      // AND the service fails for the new reaction
      let rejectSendReaction: (value: any) => void = () => {};
      mockSendReaction.mockReturnValue(
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
      expect(screen.getByTestId(DATA_TEST_ID.ICON_LIKE_ACTIVE)).toBeInTheDocument();
      // AND the service to be called with the like reaction
      expect(mockSendReaction).toHaveBeenCalledWith(givenSessionId, givenMessageId, {
        kind: ReactionType.LIKED,
        reason: null,
      });

      // WHEN the service request fails
      rejectSendReaction(new Error("Failed to submit like reaction"));

      // THEN expect the reaction to roll back to the previous reaction
      await waitFor(() => {
        expect(screen.getByTestId(DATA_TEST_ID.ICON_DISLIKE_ACTIVE)).toBeInTheDocument();
      });
      // AND expect the snackbar to show an error message
      expect(useSnackbar().enqueueSnackbar).toHaveBeenCalledWith("Failed to submit the feedback. Please try again.", {
        variant: "error",
      });
    });

    test.each([
      [ReactionType.LIKED, DATA_TEST_ID.BUTTON_LIKE],
      [ReactionType.DISLIKED, DATA_TEST_ID.BUTTON_DISLIKE],
    ])("should handle %s reaction removal successfully", async (reaction, buttonTestId) => {
      // GIVEN a message ID, session ID, and onReactionChange function
      const givenMessageId = "123";
      const givenSessionId = 234;
      const givenCurrentReaction = {
        id: "456",
        kind: reaction,
      };
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND a mocked service that resolves
      mockDeleteReaction.mockResolvedValueOnce();

      // AND the component is rendered with the current reaction
      render(<ReactionButtons messageId={givenMessageId} currentReaction={givenCurrentReaction} />);

      // WHEN the reaction button is clicked to remove the reaction
      const button = screen.getByTestId(buttonTestId);
      await userEvent.click(button);
    });

    test.each([
      [ReactionType.LIKED, DATA_TEST_ID.BUTTON_LIKE, "Failed to remove the like feedback"],
      [ReactionType.DISLIKED, DATA_TEST_ID.BUTTON_DISLIKE, "Failed to remove the dislike feedback"],
    ])("should handle %s reaction removal failure", async (reaction, buttonTestId, errorMessage) => {
      // GIVEN a message ID, session ID, and onReactionChange function
      const givenMessageId = "123";
      const givenSessionId = 234;
      const givenCurrentReaction = {
        id: "456",
        kind: reaction,
      };
      mockGetActiveSessionId.mockReturnValue(givenSessionId);

      // AND a mocked service that rejects
      mockDeleteReaction.mockRejectedValueOnce(new Error("Failed to remove reaction"));

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
