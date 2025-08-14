// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { act, userEvent, render, screen } from "src/_test_utilities/test-utils";
import RotateToSolvePuzzle, { DATA_TEST_ID } from "./RotateToSolvePuzzle";

beforeEach(() => {
  jest.useFakeTimers();
  // we do this so that we can get deterministic angles
  // remove the randomness and all characters start at -2 * rotationStep (e.g., -90deg when rotationStep=45)
  // meaning we can rotate them to the correct position with 2 clockwise rotations or 6 counterclockwise rotations
  // this is useful for testing the rotation logic without worrying about random starting angles
  jest.spyOn(global.Math, "random").mockReturnValue(0);
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

const setupUser = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const clickRotateRight = async (user: ReturnType<typeof userEvent.setup>) => {
  const rotateRight = screen.getByTestId(DATA_TEST_ID.ROTATE_RIGHT_BUTTON);
  await user.click(rotateRight);
};

const clickRotateLeft = async (user: ReturnType<typeof userEvent.setup>) => {
  const rotateLeft = screen.getByTestId(DATA_TEST_ID.ROTATE_LEFT_BUTTON);
  await user.click(rotateLeft);
};

describe("RotateToSolvePuzzle", () => {
  test("should render instructions and allow cancel", async () => {
    // GIVEN a puzzle component with a cancel handler
    const onCancel = jest.fn();
    const givenComponent = <RotateToSolvePuzzle onCancel={onCancel} onSuccess={jest.fn()} />;

    // WHEN it is rendered
    const user = setupUser();
    render(givenComponent);

    // THEN expect the instruction text to be visible
    expect(screen.getByTestId(DATA_TEST_ID.INSTRUCTION_TEXT)).toBeInTheDocument();
    // AND expect clicking cancel to call the handler
    await user.click(screen.getByTestId(DATA_TEST_ID.CANCEL_BUTTON));
    expect(onCancel).toHaveBeenCalledTimes(1);

    // AND expect no console errors/warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("for a single puzzle, should solve and report metrics on select/rotate/final", async () => {
    // GIVEN a single-puzzle game and a metrics spy
    const actualOnSuccess = jest.fn();
    const actualReport = jest.fn();
    let now = 1000;
    jest.spyOn(performance, "now").mockImplementation(() => (now += 100));
    const givenComponent = (
      <RotateToSolvePuzzle
        onCancel={jest.fn()}
        onSuccess={actualOnSuccess}
        onReport={actualReport}
        stringPool={["AB"]}
        puzzles={1}
        rotationStep={45}
        tolerance={45}
      />
    );

    // WHEN the user selects and rotates letters to solve the puzzle
    const user = setupUser();
    render(givenComponent);
    const givenCharacterBoxes = screen.getAllByTestId(DATA_TEST_ID.CHARACTER_BOX);
    // select first letter -> immediate onReport
    await user.click(givenCharacterBoxes[0]);
    await clickRotateRight(user);
    await clickRotateRight(user);
    await user.click(givenCharacterBoxes[1]);
    await clickRotateRight(user);
    await clickRotateRight(user);

    // THEN expect the final completion message to appear
    expect(await screen.findByTestId(DATA_TEST_ID.COMPLETION_MESSAGE)).toBeInTheDocument();
    // AND the completion message should have the correct text
    expect(screen.getByTestId(DATA_TEST_ID.COMPLETION_MESSAGE)).toHaveTextContent("All puzzles complete! Well done!");
    // AND expect onSuccess to be called after the feedback timeout
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(actualOnSuccess).toHaveBeenCalledTimes(1);
    // AND expect multiple metrics reports to have been sent
    // 1. Selecting the first character.
    // 2. Rotating the first character (twice).
    // 3. Selecting the second character.
    // 4. Rotating the second character (twice).
    // 5. Final puzzle completion report.
    expect(actualReport).toHaveBeenCalledTimes(7);
    expect(actualReport).toHaveBeenLastCalledWith({
      clicks_count: 6,
      correct_rotations: 2,
      puzzles_solved: 1,
      time_spent_ms: 600, // 6 clicks and rotations at 100ms intervals
    })

    // AND expect no console errors/warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should show intermediate completion for mid puzzle and proceed, then finish and call onSuccess", async () => {
    // GIVEN two puzzles
    const actualOnSuccess = jest.fn();
    const actualReport = jest.fn();
    const givenComponent = (
      <RotateToSolvePuzzle
        onCancel={jest.fn()}
        onSuccess={actualOnSuccess}
        onReport={actualReport}
        stringPool={["AB", "CD"]}
        puzzles={2}
        rotationStep={45}
        tolerance={45}
      />
    );

    // WHEN solving the first puzzle
    const user = setupUser();
    render(givenComponent);
    const givenPuzzle1CharacterBoxes = screen.getAllByTestId(DATA_TEST_ID.CHARACTER_BOX);
    await user.click(givenPuzzle1CharacterBoxes[0]);
    await clickRotateRight(user);
    await clickRotateRight(user);
    await user.click(givenPuzzle1CharacterBoxes[1]);
    await clickRotateRight(user);
    await clickRotateRight(user);

    // THEN expect an intermediate completion message to be shown
    expect(await screen.findByTestId(DATA_TEST_ID.COMPLETION_MESSAGE)).toBeInTheDocument();
    // AND expect the message to indicate partial completion
    expect(screen.getByTestId(DATA_TEST_ID.COMPLETION_MESSAGE)).toHaveTextContent(
      "Puzzle complete! Please solve another one or cancel if you are not that interested in the information."
    );

    // WHEN the feedback delay elapses
    act(() => {
      jest.runOnlyPendingTimers();
    });

    // AND the second puzzle is solved
    const givenPuzzle2CharacterBoxes = screen.getAllByTestId(DATA_TEST_ID.CHARACTER_BOX);
    await user.click(givenPuzzle2CharacterBoxes[0]);
    await clickRotateRight(user);
    await clickRotateRight(user);
    await user.click(givenPuzzle2CharacterBoxes[1]);
    await clickRotateRight(user);
    await clickRotateRight(user);

    // THEN expect final completion to be shown
    expect(await screen.findByTestId(DATA_TEST_ID.COMPLETION_MESSAGE)).toBeInTheDocument();
    // AND expect onSuccess to be called after delay
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(actualOnSuccess).toHaveBeenCalledTimes(1);
    // AND expect metrics to be reported at least once
    expect(actualReport).toHaveBeenCalled();

    // AND expect no console errors/warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  const guardedModes: Array<[string, Record<string, boolean>]> = [
    ["disabled mode", { disabled: true }],
    ["replay mode", { isReplay: true }],
  ];

  test.each(guardedModes)("should prevent interactions in %s", async (description, props) => {
    // GIVEN a guarded mode
    const actualReport = jest.fn();
    const givenComponent = (
      <RotateToSolvePuzzle
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
        onReport={actualReport}
        stringPool={["AB"]}
        puzzles={1}
        rotationStep={45}
        tolerance={45}
        {...props}
      />
    );

    // WHEN attempting to interact
    const user = setupUser();
    render(givenComponent);
    const givenRotateClockwiseButton = screen.getByTestId(DATA_TEST_ID.ROTATE_RIGHT_BUTTON);
    const givenRotateCounterClockwiseButton = screen.getByTestId(DATA_TEST_ID.ROTATE_LEFT_BUTTON);
    // THEN expect rotation buttons to be disabled
    expect(givenRotateClockwiseButton).toBeDisabled();
    expect(givenRotateCounterClockwiseButton).toBeDisabled();
    // AND expect clicking letters yields no reports
    const givenCharacterBoxes = screen.getAllByTestId(DATA_TEST_ID.CHARACTER_BOX);
    await user.click(givenCharacterBoxes[0]);
    expect(actualReport).not.toHaveBeenCalled();

    // AND expect no console errors/warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should display final completion message and lock UI when replay is finished", async () => {
    // GIVEN replay finished state
    const givenComponent = (
      <RotateToSolvePuzzle
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
        stringPool={["AB"]}
        puzzles={1}
        rotationStep={45}
        tolerance={45}
        isReplay
        isReplayFinished
      />
    );

    // WHEN rendering the component
    render(givenComponent);

    // THEN expect the final completion message to be shown
    expect(await screen.findByTestId(DATA_TEST_ID.COMPLETION_MESSAGE)).toBeInTheDocument();
    // AND expect the controls to be disabled
    expect(screen.getByTestId(DATA_TEST_ID.ROTATE_RIGHT_BUTTON)).toBeDisabled();
    expect(screen.getByTestId(DATA_TEST_ID.ROTATE_LEFT_BUTTON)).toBeDisabled();

    // AND expect no console errors/warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should handle counterclockwise rotation path as well", async () => {
    // GIVEN a single-letter puzzle
    const givenComponent = (
      <RotateToSolvePuzzle
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
        stringPool={["A"]}
        puzzles={1}
        rotationStep={45}
        tolerance={45}
      />
    );

    // WHEN rotating with both controls
    const user = setupUser();
    render(givenComponent);
    const givenCharacterBoxes = screen.getAllByTestId(DATA_TEST_ID.CHARACTER_BOX);
    await user.click(givenCharacterBoxes[0]);
    await clickRotateLeft(user);
    await clickRotateLeft(user);
    await clickRotateRight(user);
    await clickRotateRight(user);
    await clickRotateRight(user);
    await clickRotateRight(user);

    // THEN expect completion to eventually appear
    expect(await screen.findByTestId(DATA_TEST_ID.COMPLETION_MESSAGE)).toBeInTheDocument();
    act(() => {
      jest.runOnlyPendingTimers();
    });

    // AND expect no console errors/warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("should ignore rotation when no character is selected", async () => {
    // GIVEN a puzzle just rendered with no selection
    const actualOnCancel = jest.fn();
    const actualOnSuccess = jest.fn();
    const actualReport = jest.fn();

    const user = setupUser();
    render(
      <RotateToSolvePuzzle
        onCancel={actualOnCancel}
        onSuccess={actualOnSuccess}
        onReport={actualReport}
        stringPool={["AB"]}
        puzzles={1}
        rotationStep={45}
        tolerance={45}
      />
    );

    // WHEN clicking rotate without selecting a character first
    await clickRotateRight(user);
    await clickRotateLeft(user);

    // THEN no completion or callbacks occur; ensure still on screen with instructions
    expect(screen.getByTestId(DATA_TEST_ID.INSTRUCTION_TEXT)).toBeInTheDocument();
    expect(actualOnCancel).not.toHaveBeenCalled();
    expect(actualOnSuccess).not.toHaveBeenCalled();
    expect(actualReport).not.toHaveBeenCalled();

    // AND expect no console errors/warnings
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  test("snapshot: initial render (non-replay)", () => {
    const { container } = render(
      <RotateToSolvePuzzle onCancel={jest.fn()} onSuccess={jest.fn()} onReport={jest.fn()} />
    );
    expect(container).toMatchSnapshot();
  });
});
