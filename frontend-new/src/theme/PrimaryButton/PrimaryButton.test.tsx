// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import PrimaryButton from "./PrimaryButton";
import { mockBrowserIsOnLine, unmockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { ComponentError } from "src/error/commonErrors";

describe("Primary Button tests", () => {
  beforeEach(() => {
    unmockBrowserIsOnLine();
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
  });

  test("should render the button with default props", () => {
    // GIVEN a PrimaryButton component
    const givenTestId = "foo";
    const givenText = "Bar";
    // WHEN the component is rendered
    render(<PrimaryButton data-testid={givenTestId}>{givenText}</PrimaryButton>);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND  the component should be in the document
    const primaryButton = screen.getByTestId(givenTestId);
    expect(primaryButton).toBeInTheDocument();
    // AND the component should show the given text
    expect(primaryButton).toHaveTextContent(givenText);
    // AND the component should match the snapshot
    expect(primaryButton).toMatchSnapshot();
  });

  test("should throw an error when no children are provided", () => {
    // GIVEN no children
    // WHEN the component is rendered
    // THEN expect an error to be thrown]
    expect(() => render(
      <PrimaryButton />)).toThrow(new ComponentError("Children are required for PrimaryButton component"));
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
      const givenTestId = "foo";
      const givenText = "Bar";

      // WHEN the component is rendered
      render(<PrimaryButton disabled={testCase.disable} disableWhenOffline={testCase.disableWhenOffline} data-testid={givenTestId}>{givenText}</PrimaryButton>);

      // THEN expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      // AND the button to be enabled
      const primaryButton = screen.getByRole("button");
      expect(primaryButton).toHaveProperty("disabled", expectedState);
    });
  });

  test("should render enable->disabled->enabled when online status changes", async () => {
    // GIVEN that the internet status is online
    mockBrowserIsOnLine(true);

    const givenTestId = "foo";
    const givenText = "Bar";

    // WHEN the button is rendered
    render(<PrimaryButton disableWhenOffline={true} data-testid={givenTestId}>{givenText}</PrimaryButton>);

    // THEN expect the button to be enabled
    const primaryButton = screen.getByRole("button");
    expect(primaryButton).toBeEnabled();

    // WHEN the internet status changes to offline
    mockBrowserIsOnLine(false);

    // THEN expect the button to be disabled
    expect(primaryButton).toBeDisabled();

    // WHEN the internet status changes back to online
    mockBrowserIsOnLine(true);

    // THEN expect the button to be enabled
    expect(primaryButton).toBeEnabled();
  });
});
