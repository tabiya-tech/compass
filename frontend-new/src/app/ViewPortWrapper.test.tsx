import "src/_test_utilities/consoleMock"; // mute the console
import { render, screen } from "src/_test_utilities/test-utils";
import ViewPortWrapper from "src/app/ViewPortWrapper";

describe("ViewPortWrapper", () => {
  test("should render children successfully", () => {
    // WHEN a component is rendered as a child of the ViewPortWrapper
    render(<ViewPortWrapper>children</ViewPortWrapper>);
    // THEN expect the children to be rendered
    expect(screen.getByText("children")).toBeInTheDocument();
    // AND expect no errors or warning to have occurred
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});