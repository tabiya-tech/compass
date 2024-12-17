// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import SecondaryButton from "./SecondaryButton";
import { mockBrowserIsOnLine, unmockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";

describe("Secondary Button tests", () => {
  beforeEach(() => {
    unmockBrowserIsOnLine();
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
  });

  test("should render the button with default props", () => {
    // GIVEN a SecondaryButton component
    // WHEN the component is rendered
    render(<SecondaryButton data-testid={"foo"} />);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND  the component should be in the document
    const secondaryButton = screen.getByTestId("foo");
    expect(secondaryButton).toBeInTheDocument();
    // AND the component should match the snapshot
    expect(secondaryButton).toMatchSnapshot();
  });

  test("should render the button with provided name", () => {
    // GIVEN a SecondaryButton component with a custom name
    const customName = "Foo Bar";

    // WHEN the component is rendered
    render(<SecondaryButton>{customName}</SecondaryButton>);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND  the component should be findable by the custom name
    const secondaryButton = screen.getByText(customName);
    // AND the component should be in the document
    expect(secondaryButton).toBeInTheDocument();
    // AND the component should match the snapshot
    expect(secondaryButton).toMatchSnapshot();
  });

  describe.each([
    [true, { disable: true, disableWhenOffline: true, isOnline: true }],
    [true, { disable: true, disableWhenOffline: true, isOnline: false }],
    [true, { disable: true, disableWhenOffline: false, isOnline: true }],
    [true, { disable: true, disableWhenOffline: false, isOnline: false }],
    [true, { disable: true, disableWhenOffline: undefined, isOnline: false }],
    [false, { disable: false, disableWhenOffline: true, isOnline: true }],
    [true, { disable: false, disableWhenOffline: true, isOnline: false }],
    [false, { disable: false, disableWhenOffline: false, isOnline: true }],
    [false, { disable: false, disableWhenOffline: false, isOnline: false }],
    [false, { disable: false, disableWhenOffline: undefined, isOnline: false }],
    [false, { disable: undefined, disableWhenOffline: true, isOnline: true }],
    [true, { disable: undefined, disableWhenOffline: true, isOnline: false }],
    [false, { disable: undefined, disableWhenOffline: undefined, isOnline: true }],
    [false, { disable: undefined, disableWhenOffline: undefined, isOnline: false }],
  ])("Disabled/enabled state", (expectedState, testCase) => {
    test(`should render the button disabled = ${expectedState} when ${JSON.stringify(testCase)}`, () => {
      mockBrowserIsOnLine(testCase.isOnline);

      // WHEN the component is rendered
      render(<SecondaryButton disabled={testCase.disable} disableWhenOffline={testCase.disableWhenOffline} />);

      // THEN expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      // AND the button to be enabled
      const secondaryButton = screen.getByRole("button");
      expect(secondaryButton).toHaveProperty("disabled", expectedState);
    });
  });

  test("should render enable->disabled->enabled when online status changes", async () => {
    // GIVEN that the internet status is online
    mockBrowserIsOnLine(true);

    // WHEN the button is rendered
    render(<SecondaryButton disableWhenOffline={true} />);

    // THEN expect the button to be enabled
    const secondaryButton = screen.getByRole("button");
    expect(secondaryButton).toBeEnabled();

    // WHEN the internet status changes to offline
    mockBrowserIsOnLine(false);

    // THEN expect the button to be disabled
    expect(secondaryButton).toBeDisabled();

    // WHEN the internet status changes back to online
    mockBrowserIsOnLine(true);

    // THEN expect the button to be enabled
    expect(secondaryButton).toBeEnabled();
  });
});
