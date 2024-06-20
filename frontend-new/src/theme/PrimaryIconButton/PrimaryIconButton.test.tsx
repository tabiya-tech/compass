// mute the console
import "src/_test_utilities/consoleMock";

import React from "react";
import { render, screen } from "src/_test_utilities/test-utils";
import PrimaryIconButton from "./PrimaryIconButton";
import { mockUseTokens } from "src/_test_utilities/mockUseTokens";

describe("PrimaryIconButton tests", () => {
  beforeEach(() => {
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  beforeAll(() => mockUseTokens());

  test("should render the icon button with default props", () => {
    // GIVEN a PrimaryIconButton component
    // WHEN the component is rendered
    const givenTestID = "test-icon";
    render(<PrimaryIconButton data-testid={givenTestID} />);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND expect the icon to be in the document
    const primaryIconButton = screen.getByTestId(givenTestID);
    expect(primaryIconButton).toBeInTheDocument();
    // AND to match the snapshot
    expect(primaryIconButton).toMatchSnapshot();
  });

  test("should render the icon button with provided icon", () => {
    // GIVEN a PrimaryIconButton component with a custom icon
    const customIcon = <svg data-testid={"test-icon"} />;

    // WHEN the component is rendered
    render(<PrimaryIconButton>{customIcon}</PrimaryIconButton>);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND expect the icon to be in the document
    const actualElement = screen.getByTestId("test-icon");
    expect(actualElement).toBeInTheDocument();
    // AND to match the snapshot
    expect(actualElement).toMatchSnapshot();
  });

  describe.each([
    ["disabled is true", true],
    ["disabled is false", false],
  ])("Disabled/enabled state should", (_description: string, givenDisabledState: boolean) => {
    test(`should render the icon button disabled = ${givenDisabledState} when ${_description}`, () => {
      // GIVEN a PrimaryIconButton component with the disabled prop set
      // WHEN the component is rendered
      render(<PrimaryIconButton disabled={givenDisabledState} data-testid={"test-icon"} />);

      // THEN expect no errors or warning to have occurred
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      // AND the icon button to be enabled
      const primaryIconButton = screen.getByTestId("test-icon");
      expect(primaryIconButton).toHaveProperty("disabled", givenDisabledState);
    });
  });
});
