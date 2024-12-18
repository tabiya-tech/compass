// mute the console
import "src/_test_utilities/consoleMock";

import { render, screen } from "src/_test_utilities/test-utils";
import SecondaryButton from "./SecondaryButton";
import { unmockBrowserIsOnLine } from "src/_test_utilities/mockBrowserIsOnline";
import { ComponentError } from "src/error/commonErrors";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";

// mock the primary button component
jest.mock("src/theme/PrimaryButton/PrimaryButton", () => {
  return jest.fn().mockImplementation((props) => <div data-testid={props["data-testid"]}> {props.children}</div>);
});

describe("Secondary Button tests", () => {
  beforeEach(() => {
    unmockBrowserIsOnLine();
    (console.error as jest.Mock).mockClear();
    (console.warn as jest.Mock).mockClear();
  });

  test("should render the primary button with custom props", () => {
    // GIVEN a data test id
    const givenTestId = "foo";
    const givenText = "Bar";
    // WHEN the component is rendered
    render(<SecondaryButton data-testid={givenTestId}>{givenText}</SecondaryButton>);

    // THEN expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    // AND  the component should call the primary button component with the correct data test id
    const actualPrimaryButton = screen.getByTestId(givenTestId);
    expect(actualPrimaryButton).toBeInTheDocument();

    // AND the component should be called with the correct props
    expect(PrimaryButton).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "text",
        style: undefined,
        sx: expect.objectContaining({
          color: expect.any(Function),
        }),
        disabled: false,
        children: givenText,
      }),
      {}
    );

    // AND the component should be called with the correct children
    expect(actualPrimaryButton).toHaveTextContent(givenText);

    // AND the component should match the snapshot
    expect(actualPrimaryButton).toMatchSnapshot();
  });

  test("should throw an error when no children are provided", () => {
    // GIVEN no children
    // WHEN the component is rendered
    // THEN expect an error to have occurred
    expect(() => render(<SecondaryButton />)).toThrow(
      new ComponentError("Children are required for SecondaryButton component")
    );
  });
});
