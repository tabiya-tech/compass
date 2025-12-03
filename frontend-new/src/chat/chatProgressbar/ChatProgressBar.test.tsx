// mute chatty console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import { ConversationPhase } from "./types";
import ChatProgressBar, { DATA_TEST_ID } from "./ChatProgressBar";
import * as GetUserFriendlyConversationPhaseNameModule from "./getUserFriendlyConversationPhaseName";
import { waitFor } from "@testing-library/react";

describe("ChatProgresBar", () => {
  describe("render tests", () => {
    it("should render the progress bar with the correct phase and percentage", async () => {
      // GIVEN a percentage and phase
      const givenPercentage = 75;
      const givenPhase = ConversationPhase.INTRO;

      // AND getUserFriendlyConversationPhaseName is mocked
      const givenReturnedUserFriendlyPhaseName = "given-returned-user-friendly-phase-name";
      const mockedGetUserFriendlyConversationPhase =
        jest.spyOn(GetUserFriendlyConversationPhaseNameModule, "getUserFriendlyConversationPhaseName")
          .mockReturnValue(givenReturnedUserFriendlyPhaseName)

      // WHEN the ChatProgressBar is rendered
      render(<ChatProgressBar percentage={givenPercentage} phase={givenPhase} current={null} total={null} />);

      // THEN the getUserFriendlyConversationPhaseName function should be called with the correct phase.
      expect(mockedGetUserFriendlyConversationPhase).toHaveBeenCalledWith({
        phase: givenPhase,
        percentage: givenPercentage,
        current: null,
        total: null,
      });

      // AND the container should be in the document
      const container = screen.getByTestId(DATA_TEST_ID.CONTAINER);

      // AND the progress bar text should be in the document
      const progressBar = screen.getByTestId(DATA_TEST_ID.PROGRESS_BAR_PHASE_TEXT);
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveTextContent(givenReturnedUserFriendlyPhaseName);

      // AND the progress bar label should be in the document
      const progressBarLabel = screen.getByTestId(DATA_TEST_ID.PROGRESS_BAR_LABEL);
      expect(progressBarLabel).toBeInTheDocument();
      expect(progressBarLabel).toHaveTextContent(`${givenPercentage}%`);

      // AND the width of the progress bar should be set to the percentage
      // Wait for it because of the animation.

      const progressBarElement = screen.getByTestId(DATA_TEST_ID.PROGRESS_BAR);
      expect(progressBarElement).toBeInTheDocument();
      await waitFor(() => {
        expect(progressBarElement).toHaveStyle(`width: ${givenPercentage}%`);
      })

      // AND container should match snapshot.
      expect(container).toMatchSnapshot();
    })
  })
});
