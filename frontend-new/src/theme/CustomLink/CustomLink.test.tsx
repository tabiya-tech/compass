// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import { mockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import CustomLink from "src/theme/CustomLink/CustomLink";

describe("CustomLink", () => {
  test("renders the link with the correct text", () => {
    // GIVEN the component is rendered with a given text and href
    const givenText = "Hello";
    const givenHref = "#foo";
    render(<CustomLink href={givenHref}>{givenText}</CustomLink>);
    // THEN the link with the correct text is rendered
    expect(screen.getByText(givenText)).toBeInTheDocument();
    // AND the link has the correct href
    expect(screen.getByRole("link")).toHaveAttribute("href", givenHref);
  });

  describe.each([
    [true, { disabled: true, disableWhenOffline: true, isOnline: true }],
    [true, { disabled: true, disableWhenOffline: true, isOnline: false }],
    [true, { disabled: true, disableWhenOffline: false, isOnline: true }],
    [true, { disabled: true, disableWhenOffline: false, isOnline: false }],
    [true, { disabled: true, disableWhenOffline: undefined, isOnline: false }],
    [false, { disabled: false, disableWhenOffline: true, isOnline: true }],
    [true, { disabled: false, disableWhenOffline: true, isOnline: false }],
    [false, { disabled: false, disableWhenOffline: false, isOnline: true }],
    [false, { disabled: false, disableWhenOffline: false, isOnline: false }],
    [false, { disabled: false, disableWhenOffline: undefined, isOnline: false }],
    [false, { disabled: undefined, disableWhenOffline: true, isOnline: true }],
    [true, { disabled: undefined, disableWhenOffline: true, isOnline: false }],
    [false, { disabled: undefined, disableWhenOffline: undefined, isOnline: true }],
    [false, { disabled: undefined, disableWhenOffline: undefined, isOnline: false }],
  ])("Disabled/enabled states", (expectedState, testCase) => {
    test(`should render the link disabled = ${expectedState} when ${JSON.stringify(testCase)}`, () => {
      // GIVEN the internet status
      mockBrowserIsOnLine(testCase.isOnline);

      const givenTestId = "foo";
      const givenText = "Test Link";

      // WHEN the component is rendered
      render(
        <CustomLink
          disabled={testCase.disabled}
          disableWhenOffline={testCase.disableWhenOffline}
          data-testid={givenTestId}
        >
          {givenText}
        </CustomLink>
      );

      // THEN expect no errors or warnings to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      // AND the link to have the correct disabled state
      const linkElement = screen.getByTestId(givenTestId);
      expect(linkElement).toHaveAttribute("aria-disabled", expectedState.toString());
    });
  });

  test("should render enable->disabled->enabled when online status changes", async () => {
    // GIVEN that the internet status is online
    mockBrowserIsOnLine(true);

    const givenTestId = "foo";
    const givenText = "Test Link";

    // WHEN the link is rendered
    render(
      <CustomLink disableWhenOffline={true} data-testid={givenTestId}>
        {givenText}
      </CustomLink>
    );

    // THEN expect the link to be enabled
    const linkElement = screen.getByTestId(givenTestId);
    expect(linkElement).toHaveAttribute("aria-disabled", "false");

    // WHEN the internet status changes to offline
    mockBrowserIsOnLine(false);

    // THEN expect the link to be disabled
    expect(linkElement).toHaveAttribute("aria-disabled", "true");

    // WHEN the internet status changes back to online
    mockBrowserIsOnLine(true);

    // THEN expect the link to be enabled again
    expect(linkElement).toHaveAttribute("aria-disabled", "false");
  });
});
