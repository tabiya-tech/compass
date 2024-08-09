// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import InactiveBackdrop, { DATA_TEST_ID } from "src/theme/Backdrop/InactiveBackdrop";

describe("InactiveBackdrop render tests", () => {
  test("should show InactiveBackdrop when isShown is true", () => {
    // GIVEN an isShown value
    const givenIsShown = true;

    // WHEN the InactiveBackdrop is opened
    render(<InactiveBackdrop isShown={givenIsShown} />);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the InactiveBackdrop should be visible
    const inactiveBackdrop = screen.getByTestId(DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER);
    expect(inactiveBackdrop).toBeVisible();
    // AND the message should be visible
    const message = screen.getByTestId(DATA_TEST_ID.INACTIVE_BACKDROP_MESSAGE);
    expect(message).toBeVisible();
    // AND the InactiveBackdrop should match the snapshot
    expect(inactiveBackdrop).toMatchSnapshot();
  });

  test("should not show InactiveBackdrop when isShown is false", () => {
    // GIVEN an isShown value
    const givenIsShown = false;

    // WHEN the InactiveBackdrop is closed
    render(<InactiveBackdrop isShown={givenIsShown} />);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND the InactiveBackdrop should not be visible
    const inactiveBackdrop = screen.queryByTestId(DATA_TEST_ID.INACTIVE_BACKDROP_CONTAINER);
    expect(inactiveBackdrop).not.toBeVisible();
  });
});
